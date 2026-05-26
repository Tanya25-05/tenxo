package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/MicahParks/keyfunc/v3"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	// "github.com/aws/aws-sdk-go-v2/feature/s3/presign"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"github.com/nats-io/nats.go"
	"github.com/redis/go-redis/v9"

	"github.com/gpu-grid/matchmaker/payment"
	"github.com/gpu-grid/matchmaker/signaling"
)

type Server struct {
	nc   *nats.Conn
	js   nats.JetStreamContext
	rdb  *redis.Client
	jwks keyfunc.Keyfunc
	// WebSocket clients keyed by userID
	wsClients map[string]map[*websocket.Conn]bool
	wsMu      sync.Mutex
}

type JobRequest struct {
	EncryptedJobLink string `json:"encrypted_job_link"`
	JobLink          string `json:"job_link"`
	JobID            string `json:"job_id"`
	EncKeyB64        string `json:"enc_key_b64"`
	SaltB64          string `json:"salt_b64"`
}

type HeartbeatPayload struct {
	NodeID string `json:"node_id"`
	Status string `json:"status"`
	Owner  string `json:"owner"`
}

type NodeInfo struct {
	NodeID string `json:"node_id"`
	Status string `json:"status"`
	TTL    int64  `json:"ttl_seconds"`
}

type PresignRequest struct {
	EncKeyB64 string `json:"enc_key_b64,omitempty"`
	JobID     string `json:"job_id,omitempty"`
}

type PresignResponse struct {
	UploadURL       string `json:"upload_url"`
	ResultUploadURL string `json:"result_upload_url"`
	ResultURL       string `json:"result_url"`
	JobID           string `json:"job_id"`
	EncKeyB64       string `json:"enc_key_b64"`
}

func main() {
	natsURL := getEnv("NATS_URL", nats.DefaultURL)
	redisAddr := getEnv("REDIS_ADDR", "localhost:6379")
	redisPassword := os.Getenv("REDIS_PASSWORD")
	streamName := getEnv("NATS_STREAM", "JOB_STREAM")
	apiAddr := getEnv("API_ADDR", ":8080")

	log.Printf("Starting matchmaker: NATS=%s Redis=%s", natsURL, redisAddr)

	// Redis
	rdb := redis.NewClient(&redis.Options{
		Addr:     redisAddr,
		Password: redisPassword,
		DB:       0,
	})

	if err := rdb.Ping(context.Background()).Err(); err != nil {
		log.Fatalf("redis ping failed: %v", err)
	}

	// NATS
	nc, err := nats.Connect(natsURL)
	if err != nil {
		log.Fatalf("nats connect failed: %v", err)
	}
	defer nc.Drain()

	js, err := nc.JetStream()
	if err != nil {
		log.Fatalf("jetstream setup failed: %v", err)
	}

	if err := ensureStream(js, streamName); err != nil {
		log.Fatalf("could not ensure JetStream stream: %v", err)
	}

// JWKS (Supabase) - optional
	var jwks keyfunc.Keyfunc
	jwksURL := os.Getenv("SUPABASE_JWKS_URL")
	if jwksURL != "" {
		log.Printf("Loading JWKS from %s", jwksURL)
		
		// NewDefault automatically fetches the keys and sets up a background refresh
		var err error
		jwks, err = keyfunc.NewDefault([]string{jwksURL})
		if err != nil {
			log.Printf("warning: failed to load JWKS: %v", err)
			jwks = nil
		}
	} else {
		log.Printf("SUPABASE_JWKS_URL not set; JWT verification disabled")
	}

	srv := &Server{nc: nc, js: js, rdb: rdb, jwks: jwks, wsClients: make(map[string]map[*websocket.Conn]bool)}
	go srv.listenHeartbeats(context.Background())
	go srv.subscribeResults()

	http.HandleFunc("/jobs", cors(srv.handleJobs))
	http.HandleFunc("/nodes", cors(srv.handleNodes))
	http.HandleFunc("/my-nodes", cors(srv.handleMyNodes))
	http.HandleFunc("/presign", cors(srv.handlePresign))
	http.HandleFunc("/jobs/", cors(srv.handleJobStatus))
	http.HandleFunc("/storage/upload/", cors(srv.handleStorageUpload))
	http.HandleFunc("/storage/result-upload/", cors(srv.handleStorageResultUpload))
	http.HandleFunc("/storage/result/", cors(srv.handleStorageGet))
	http.HandleFunc("/ws", cors(srv.handleWS))
	http.HandleFunc("/health", cors(handleHealth))

	// Zero-knowledge key exchange signaling (routes only, never inspects keys)
	RegisterSignalingRoutes(http.DefaultServeMux)

	// Billing / Razorpay — Vast.ai/RunPod model (pay-as-you-go, card + UPI)
	paymentHandler := payment.NewBillingHandler(rdb)
	if paymentHandler.Enabled() {
		http.HandleFunc("/billing/customer", cors(paymentHandler.HandleCreateCustomer))
		http.HandleFunc("/billing/setup-intent", cors(paymentHandler.HandleCreateSetupIntent))
		http.HandleFunc("/billing/verify-payment", cors(paymentHandler.HandleVerifyPayment))
		http.HandleFunc("/billing/payment-methods", cors(paymentHandler.HandleListPaymentMethods))
		http.HandleFunc("/billing/track-usage", cors(paymentHandler.HandleTrackUsage))
		http.HandleFunc("/billing/charge", cors(paymentHandler.HandleCharge))
		http.HandleFunc("/billing/usage", cors(paymentHandler.HandleGetUsage))
		http.HandleFunc("/billing/webhook", cors(paymentHandler.HandleWebhook))
		log.Println("payment: Razorpay PAYG billing (card+UPI) — /billing/*")
	} else {
		log.Println("payment: billing disabled — set RAZORPAY_KEY_ID to enable")
	}

	log.Printf("HTTP server listening on %s", apiAddr)
	if err := http.ListenAndServe(apiAddr, nil); err != nil {
		log.Fatalf("http server failed: %v", err)
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func cors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-API-Key")

		// Handle preflight requests
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next(w, r)
	}
}

func ensureStream(js nats.JetStreamContext, name string) error {
	_, err := js.StreamInfo(name)
	if err == nil {
		return nil
	}
	if err == nats.ErrStreamNotFound {
		_, err = js.AddStream(&nats.StreamConfig{
			Name:      name,
			Subjects:  []string{"jobs"},
			Storage:   nats.FileStorage,
			Retention: nats.WorkQueuePolicy,
		})
	}
	return err
}

func (s *Server) r2Client(ctx context.Context) (*s3.Client, string, error) {
	accessKey := os.Getenv("R2_ACCESS_KEY_ID")
	secretKey := os.Getenv("R2_SECRET_ACCESS_KEY")
	accountID := os.Getenv("R2_ACCOUNT_ID")
	bucket := os.Getenv("R2_BUCKET")
	
	if accessKey == "" || secretKey == "" || accountID == "" || bucket == "" {
		return nil, "", nil
	}
	
	endpoint := os.Getenv("R2_ENDPOINT")
	if endpoint == "" {
		endpoint = fmt.Sprintf("https://%s.r2.cloudflarestorage.com", accountID)
	}

	cfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion("auto"),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")),
	)
	if err != nil {
		return nil, "", err
	}
	
	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true
	})
	
	return client, bucket, nil
}

func (s *Server) getUploadURLs(ctx context.Context, jobID string) (uploadURL, resultUploadURL, resultURL string, err error) {
	client, bucket, err := s.r2Client(ctx)
	public := getEnv("PUBLIC_API_URL", "http://localhost:8080")
	if err != nil {
		return "", "", "", err
	}
	if client != nil {
		uploadKey := fmt.Sprintf("jobs/%s.enc", jobID)
		resultKey := fmt.Sprintf("results/%s.enc", jobID)
		presigner := s3.NewPresignClient(client)

		putReq, err := presigner.PresignPutObject(ctx, &s3.PutObjectInput{Bucket: &bucket, Key: &uploadKey})

		if err != nil {
			return "", "", "", err
		}
		resultPutReq, err := presigner.PresignPutObject(ctx, &s3.PutObjectInput{Bucket: &bucket, Key: &resultKey})
		if err != nil {
			return "", "", "", err
		}
		getReq, err := presigner.PresignGetObject(ctx, &s3.GetObjectInput{Bucket: &bucket, Key: &resultKey})
		if err != nil {
			return "", "", "", err
		}
		return putReq.URL, resultPutReq.URL, getReq.URL, nil
	}

	uploadURL = fmt.Sprintf("%s/storage/upload/%s", public, jobID)
	resultUploadURL = fmt.Sprintf("%s/storage/result-upload/%s", public, jobID)
	resultURL = fmt.Sprintf("%s/storage/result/%s", public, jobID)
	return uploadURL, resultUploadURL, resultURL, nil
}

// parseAndValidateToken parses a JWT token string and returns the parsed token after validation
func (s *Server) parseAndValidateToken(tokenStr string) (*jwt.Token, error) {
	if tokenStr == "" {
		return nil, errors.New("missing token")
	}
	if s.jwks == nil {
		return nil, errors.New("jwks not configured")
	}
	token, err := jwt.Parse(tokenStr, s.jwks.Keyfunc)
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("invalid token")
	}
	return token, nil
}

func (s *Server) handleJobs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Auth: Accept Authorization: Bearer <token> or X-API-Key: <token>
	authHeader := r.Header.Get("Authorization")
	token := ""
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		token = strings.TrimSpace(authHeader[7:])
	}
	if token == "" {
		token = r.Header.Get("X-API-Key")
	}

	if token == "" {
		http.Error(w, "missing auth token", http.StatusUnauthorized)
		return
	}
	userID, err := s.validateAuth(token)
	if err != nil {
		http.Error(w, "invalid token: "+err.Error(), http.StatusUnauthorized)
		return
	}

	var payload JobRequest
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "invalid JSON payload", http.StatusBadRequest)
		return
	}
	if payload.EncryptedJobLink == "" && payload.JobLink == "" {
		http.Error(w, "missing encrypted_job_link", http.StatusBadRequest)
		return
	}
	jobLink := payload.EncryptedJobLink
	if jobLink == "" {
		jobLink = payload.JobLink
	}

	jobID := payload.JobID
	if jobID == "" {
		jobID = fmt.Sprintf("job-%d", time.Now().UnixNano())
	}

	ctx := context.Background()
	jobKey := fmt.Sprintf("job:%s", jobID)

	// Merge new fields into existing job hash (don't blow away presign data)
	updates := map[string]interface{}{
		"owner":      userID,
		"status":     "queued",
		"upload_url": jobLink,
	}
	if payload.EncKeyB64 != "" {
		updates["enc_key_b64"] = payload.EncKeyB64
	}
	if payload.SaltB64 != "" {
		updates["salt_b64"] = payload.SaltB64
	}
	_, _ = s.rdb.HSet(ctx, jobKey, updates).Result()

	// Fetch result_upload_url (set by presign or from env default)
	resultUploadURL, _ := s.rdb.HGet(ctx, jobKey, "result_upload_url").Result()
	if resultUploadURL == "" {
		// If no presign was done, build a default result upload URL
		public := getEnv("PUBLIC_API_URL", "http://localhost:8080")
		resultUploadURL = fmt.Sprintf("%s/storage/result-upload/%s", public, jobID)
		_, _ = s.rdb.HSet(ctx, jobKey, "result_upload_url", resultUploadURL).Result()
	}

	msg := map[string]string{
		"job_id":             jobID,
		"encrypted_job_link": jobLink,
		"result_upload_url":  resultUploadURL,
		"owner":              userID,
	}
	if payload.EncKeyB64 != "" {
		msg["enc_key_b64"] = payload.EncKeyB64
	}
	if payload.SaltB64 != "" {
		msg["salt_b64"] = payload.SaltB64
	}
	msgData, err := json.Marshal(msg)
	if err != nil {
		http.Error(w, "failed to serialize job", http.StatusInternalServerError)
		return
	}

	_, err = s.js.Publish("jobs", msgData)
	if err != nil {
		http.Error(w, "failed to enqueue job", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "queued", "subject": "jobs"})
}

func (s *Server) handleNodes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx := context.Background()
	var cursor uint64
	var nodes []NodeInfo

	for {
		keys, nextCursor, err := s.rdb.Scan(ctx, cursor, "node:*", 100).Result()
		if err != nil {
			http.Error(w, "failed to scan nodes", http.StatusInternalServerError)
			return
		}
		cursor = nextCursor

		for _, key := range keys {
			status, err := s.rdb.Get(ctx, key).Result()
			if err != nil {
				continue
			}
			ttl, err := s.rdb.TTL(ctx, key).Result()
			if err != nil {
				ttl = 0
			}
			nodes = append(nodes, NodeInfo{
				NodeID: strings.TrimPrefix(key, "node:"),
				Status: status,
				TTL:    int64(ttl.Seconds()),
			})
		}
		if cursor == 0 {
			break
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"nodes": nodes})
}

func (s *Server) handleMyNodes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	authHeader := r.Header.Get("Authorization")
	tokenStr := ""
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		tokenStr = strings.TrimSpace(authHeader[7:])
	}
	if tokenStr == "" {
		tokenStr = r.Header.Get("X-API-Key")
	}
	if tokenStr == "" {
		http.Error(w, "missing auth token", http.StatusUnauthorized)
		return
	}

	token, err := s.parseAndValidateToken(tokenStr)
	if err != nil {
		http.Error(w, "invalid token: "+err.Error(), http.StatusUnauthorized)
		return
	}

	var userID string
	if claims, ok := token.Claims.(jwt.MapClaims); ok {
		if sub, ok := claims["sub"].(string); ok {
			userID = sub
		}
	}
	if userID == "" {
		http.Error(w, "missing sub claim in token", http.StatusUnauthorized)
		return
	}

	ctx := context.Background()
	var cursor uint64
	var nodes []NodeInfo

	for {
		keys, nextCursor, err := s.rdb.Scan(ctx, cursor, "node:*", 100).Result()
		if err != nil {
			http.Error(w, "failed to scan nodes", http.StatusInternalServerError)
			return
		}
		cursor = nextCursor

		for _, key := range keys {
			nodeID := strings.TrimPrefix(key, "node:")
			ownerKey := fmt.Sprintf("node_owner:%s", nodeID)
			owner, err := s.rdb.Get(ctx, ownerKey).Result()
			if err != nil {
				continue
			}
			if owner != userID {
				continue
			}
			status, err := s.rdb.Get(ctx, key).Result()
			if err != nil {
				continue
			}
			ttl, err := s.rdb.TTL(ctx, key).Result()
			if err != nil {
				ttl = 0
			}
			nodes = append(nodes, NodeInfo{
				NodeID: nodeID,
				Status: status,
				TTL:    int64(ttl.Seconds()),
			})
		}
		if cursor == 0 {
			break
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"nodes": nodes})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// ─── Signaling Routes (Zero-Knowledge ECDH Key Exchange) ───────────────────

var signalStore *signaling.SessionStore

func initSignaling() {
	signalStore = signaling.NewSessionStore()
}

func RegisterSignalingRoutes(mux *http.ServeMux) {
	initSignaling()

	// WebSocket endpoints for real-time key exchange
	mux.HandleFunc("/signal/agent", cors(signalStore.HandleAgentWS))
	mux.HandleFunc("/signal/client", cors(signalStore.HandleClientWS))

	// REST endpoints for CLI-based polling flow
	mux.HandleFunc("/signal/session", cors(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			signalStore.HandleCreateSession(w, r)
		case http.MethodGet:
			signalStore.HandleGetSession(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}))
	mux.HandleFunc("/signal/client-key", cors(signalStore.HandlePostClientKey))

	log.Println("signaling: zero-knowledge ECDH routes registered")
}

func (s *Server) listenHeartbeats(ctx context.Context) {
	_, err := s.nc.Subscribe("heartbeats.>", func(msg *nats.Msg) {
		hb := HeartbeatPayload{Status: "idle"}
		if len(msg.Data) > 0 {
			_ = json.Unmarshal(msg.Data, &hb)
		}

		if hb.NodeID == "" {
			hb.NodeID = strings.TrimPrefix(msg.Subject, "heartbeats.")
		}
		if hb.NodeID == "" {
			log.Printf("heartbeat missing node ID: subject=%s", msg.Subject)
			return
		}
		if hb.Status == "" {
			hb.Status = "idle"
		}

		key := fmt.Sprintf("node:%s", hb.NodeID)
		if err := s.rdb.Set(ctx, key, hb.Status, 60*time.Second).Err(); err != nil {
			log.Printf("failed to update node state for %s: %v", hb.NodeID, err)
			return
		}
		
		if hb.Owner != "" {
			ownerKey := fmt.Sprintf("node_owner:%s", hb.NodeID)
			if err := s.rdb.Set(ctx, ownerKey, hb.Owner, 0).Err(); err != nil {
				log.Printf("failed to set node owner for %s: %v", hb.NodeID, err)
			}
		}
		log.Printf("node %s updated to %s", hb.NodeID, hb.Status)
	})
	if err != nil {
		log.Fatalf("failed to subscribe to heartbeats: %v", err)
	}
	log.Printf("subscribed to heartbeats.> and tracking node state in Redis")
}

func (s *Server) validateAuth(token string) (string, error) {
	if token == "" {
		return "", errors.New("empty token")
	}
	
	h := sha256.Sum256([]byte(token))
	hexk := hex.EncodeToString(h[:])
	ctx := context.Background()
	if uid, err := s.rdb.Get(ctx, fmt.Sprintf("api_key:%s", hexk)).Result(); err == nil {
		return uid, nil
	}
	
	if s.jwks != nil {
		t, err := s.parseAndValidateToken(token)
		if err != nil {
			return "", err
		}
		if claims, ok := t.Claims.(jwt.MapClaims); ok {
			if sub, ok := claims["sub"].(string); ok {
				return sub, nil
			}
		}
		return "", errors.New("sub claim missing in token")
	}
	return "", errors.New("invalid api key or jwt")
}

func (s *Server) handlePresign(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	authHeader := r.Header.Get("Authorization")
	token := ""
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		token = strings.TrimSpace(authHeader[7:])
	}
	if token == "" {
		token = r.Header.Get("X-API-Key")
	}
	if token == "" {
		token = r.URL.Query().Get("token")
	}
	if token == "" {
		http.Error(w, "missing auth token", http.StatusUnauthorized)
		return
	}
	userID, err := s.validateAuth(token)
	if err != nil {
		http.Error(w, "unauthorized: "+err.Error(), http.StatusUnauthorized)
		return
	}

	var req PresignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON payload", http.StatusBadRequest)
		return
	}

	keyB64 := req.EncKeyB64
	if keyB64 == "" {
		keyBytes := make([]byte, 32)
		if _, err := rand.Read(keyBytes); err != nil {
			http.Error(w, "failed to generate encryption key", http.StatusInternalServerError)
			return
		}
		keyB64 = base64.StdEncoding.EncodeToString(keyBytes)
	} else {
		decoded, err := base64.StdEncoding.DecodeString(keyB64)
		if err != nil || len(decoded) != 32 {
			http.Error(w, "enc_key_b64 must be valid base64 of 32 bytes", http.StatusBadRequest)
			return
		}
	}

	jobID := req.JobID
	if jobID == "" {
		jobID = fmt.Sprintf("job-%d", time.Now().UnixNano())
	}

	ctx := context.Background()
	uploadURL, resultUploadURL, resultURL, err := s.getUploadURLs(ctx, jobID)
	if err != nil {
		http.Error(w, "failed to create presigned URLs: "+err.Error(), http.StatusInternalServerError)
		return
	}

	jobKey := fmt.Sprintf("job:%s", jobID)
	_, _ = s.rdb.HSet(ctx, jobKey, map[string]interface{}{
		"owner":             userID,
		"status":            "created",
		"upload_url":        uploadURL,
		"result_upload_url": resultUploadURL,
		"result_url":        resultURL,
		"enc_key_b64":       keyB64,
	}).Result()

	resp := PresignResponse{
		UploadURL:       uploadURL,
		ResultUploadURL: resultUploadURL,
		ResultURL:       resultURL,
		JobID:           jobID,
		EncKeyB64:       keyB64,
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleStorageUpload(w http.ResponseWriter, r *http.Request) {
	jobID := strings.TrimPrefix(r.URL.Path, "/storage/upload/")
	if jobID == "" {
		http.Error(w, "missing job id", http.StatusBadRequest)
		return
	}
	ctx := context.Background()
	jobKey := fmt.Sprintf("job:%s", jobID)
	exists, err := s.rdb.Exists(ctx, jobKey).Result()
	if err != nil || exists == 0 {
		http.Error(w, "unknown job id", http.StatusNotFound)
		return
	}

	uploadsDir := getEnv("UPLOADS_DIR", "uploads")

	if r.Method == http.MethodGet {
		filePath := filepath.Join(uploadsDir, jobID+".enc")
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			http.Error(w, "file not found", http.StatusNotFound)
			return
		}
		http.ServeFile(w, r, filePath)
		return
	}

	if r.Method != http.MethodPut && r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	_ = os.MkdirAll(uploadsDir, 0o755)
	filePath := filepath.Join(uploadsDir, jobID+".enc")
	f, err := os.Create(filePath)
	if err != nil {
		http.Error(w, "failed to create file", http.StatusInternalServerError)
		return
	}
	defer f.Close()
	_, err = io.Copy(f, r.Body)
	if err != nil {
		http.Error(w, "failed to write file", http.StatusInternalServerError)
		return
	}

	_, _ = s.rdb.HSet(ctx, jobKey, "status", "uploaded", "upload_path", filePath).Result()
	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleStorageResultUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut && r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	jobID := strings.TrimPrefix(r.URL.Path, "/storage/result-upload/")
	if jobID == "" {
		http.Error(w, "missing job id", http.StatusBadRequest)
		return
	}
	ctx := context.Background()
	jobKey := fmt.Sprintf("job:%s", jobID)
	exists, err := s.rdb.Exists(ctx, jobKey).Result()
	if err != nil || exists == 0 {
		http.Error(w, "unknown job id", http.StatusNotFound)
		return
	}

	uploadsDir := getEnv("UPLOADS_DIR", "uploads")
	_ = os.MkdirAll(uploadsDir, 0o755)
	filePath := filepath.Join(uploadsDir, jobID+".result.enc")
	f, err := os.Create(filePath)
	if err != nil {
		http.Error(w, "failed to create file", http.StatusInternalServerError)
		return
	}
	defer f.Close()
	_, err = io.Copy(f, r.Body)
	if err != nil {
		http.Error(w, "failed to write file", http.StatusInternalServerError)
		return
	}

	_, _ = s.rdb.HSet(ctx, jobKey, "status", "result_uploaded", "result_path", filePath).Result()
	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleStorageGet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	jobID := strings.TrimPrefix(r.URL.Path, "/storage/result/")
	if jobID == "" {
		http.Error(w, "missing job id", http.StatusBadRequest)
		return
	}
	ctx := context.Background()
	jobKey := fmt.Sprintf("job:%s", jobID)
	data, err := s.rdb.HGetAll(ctx, jobKey).Result()
	if err != nil || len(data) == 0 {
		http.Error(w, "unknown job id", http.StatusNotFound)
		return
	}
	
	var path string
	if p, ok := data["result_path"]; ok && p != "" {
		path = p
	} else if p, ok := data["upload_path"]; ok && p != "" {
		path = p
	}
	if path == "" {
		http.Error(w, "no file available", http.StatusNotFound)
		return
	}
	http.ServeFile(w, r, path)
}

func (s *Server) handleJobStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/jobs/")
	if strings.HasSuffix(path, "/status") {
		path = strings.TrimSuffix(path, "/status")
	}
	jobID := strings.Trim(path, "/")
	if jobID == "" {
		http.Error(w, "missing job id", http.StatusBadRequest)
		return
	}
	ctx := context.Background()
	jobKey := fmt.Sprintf("job:%s", jobID)
	data, err := s.rdb.HGetAll(ctx, jobKey).Result()
	if err != nil || len(data) == 0 {
		http.Error(w, "unknown job id", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(data)
}

func (s *Server) subscribeResults() {
	sub, err := s.nc.Subscribe("jobs.results", func(msg *nats.Msg) {
		var payload map[string]any
		_ = json.Unmarshal(msg.Data, &payload)
		jobID, _ := payload["job_id"].(string)
		status, _ := payload["status"].(string)
		resultURL, _ := payload["result_url"].(string)
		ctx := context.Background()
		jobKey := fmt.Sprintf("job:%s", jobID)
		if jobID != "" {
			if status != "" {
				_, _ = s.rdb.HSet(ctx, jobKey, "status", status).Result()
			}
			if resultURL != "" {
				_, _ = s.rdb.HSet(ctx, jobKey, "result_url", resultURL).Result()
			}
			owner, _ := s.rdb.HGet(ctx, jobKey, "owner").Result()
			if owner != "" {
				s.sendWS(owner, string(msg.Data))
			}
		}
	})
	if err != nil {
		log.Printf("failed to subscribe to jobs.results: %v", err)
		return
	}
	log.Printf("subscribed to jobs.results (%v)", sub)
}

func (s *Server) sendWS(userID, payload string) {
	s.wsMu.Lock()
	defer s.wsMu.Unlock()
	conns, ok := s.wsClients[userID]
	if !ok {
		return
	}
	for conn := range conns {
		if err := conn.WriteMessage(websocket.TextMessage, []byte(payload)); err != nil {
			conn.Close()
			delete(conns, conn)
		}
	}
	if len(conns) == 0 {
		delete(s.wsClients, userID)
	}
}

func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	token := ""
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		token = strings.TrimSpace(authHeader[7:])
	}
	if token == "" {
		token = r.Header.Get("X-API-Key")
	}
	if token == "" {
		token = r.URL.Query().Get("token")
	}
	if token == "" {
		http.Error(w, "missing auth token", http.StatusUnauthorized)
		return
	}
	userID, err := s.validateAuth(token)
	if err != nil {
		http.Error(w, "unauthorized: "+err.Error(), http.StatusUnauthorized)
		return
	}

	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, "upgrade failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	s.wsMu.Lock()
	if s.wsClients[userID] == nil {
		s.wsClients[userID] = make(map[*websocket.Conn]bool)
	}
	s.wsClients[userID][conn] = true
	s.wsMu.Unlock()

	go func() {
		defer func() {
			conn.Close()
			s.wsMu.Lock()
			delete(s.wsClients[userID], conn)
			if len(s.wsClients[userID]) == 0 {
				delete(s.wsClients, userID)
			}
			s.wsMu.Unlock()
		}()
		for {
			if _, _, err := conn.NextReader(); err != nil {
				return
			}
		}
	}()
}