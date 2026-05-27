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
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/nats-io/nats.go"

	"github.com/gpu-grid/matchmaker/payment"
	"github.com/gpu-grid/matchmaker/signaling"
	"github.com/gpu-grid/matchmaker/store"
)

type Server struct {
	nc   *nats.Conn
	js   nats.JetStreamContext
	st   store.Store
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
	databaseURL := os.Getenv("DATABASE_URL")
	streamName := getEnv("NATS_STREAM", "JOB_STREAM")
	apiAddr := getEnv("API_ADDR", ":8080")

	if databaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	log.Printf("Starting matchmaker: NATS=%s", natsURL)

	// PostgreSQL
	st, err := store.NewPGStore(context.Background(), databaseURL)
	if err != nil {
		log.Fatalf("store setup failed: %v", err)
	}
	defer st.Close()

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
		var err error
		jwks, err = keyfunc.NewDefault([]string{jwksURL})
		if err != nil {
			log.Printf("warning: failed to load JWKS: %v", err)
			jwks = nil
		}
	} else {
		log.Printf("SUPABASE_JWKS_URL not set; JWT verification disabled")
	}

	srv := &Server{nc: nc, js: js, st: st, jwks: jwks, wsClients: make(map[string]map[*websocket.Conn]bool)}
	go srv.listenHeartbeats(context.Background())
	go srv.subscribeResults()

	// Public endpoints (no auth required)
	http.HandleFunc("/health", cors(handleHealth))

	// Authenticated endpoints
	http.HandleFunc("/jobs", cors(srv.authMiddleware(srv.handleJobs)))
	http.HandleFunc("/nodes", cors(srv.authMiddleware(srv.handleNodes)))
	http.HandleFunc("/my-nodes", cors(srv.authMiddleware(srv.handleMyNodes)))
	http.HandleFunc("/presign", cors(srv.authMiddleware(srv.handlePresign)))
	http.HandleFunc("/jobs/", cors(srv.authMiddleware(srv.handleJobStatus)))
	http.HandleFunc("/storage/upload/", cors(srv.authMiddleware(srv.handleStorageUpload)))
	http.HandleFunc("/storage/result-upload/", cors(srv.authMiddleware(srv.handleStorageResultUpload)))
	http.HandleFunc("/storage/result/", cors(srv.authMiddleware(srv.handleStorageGet)))
	http.HandleFunc("/ws", cors(srv.handleWS))
	http.HandleFunc("/agent/heartbeat", cors(srv.authMiddleware(srv.handleAgentHeartbeat)))

	// Zero-knowledge key exchange signaling (routes only, never inspects keys)
	RegisterSignalingRoutes(http.DefaultServeMux)
	signalStore.SetNATS(nc)

	// Billing / Razorpay — Vast.ai/RunPod model (pay-as-you-go, card + UPI)
	paymentHandler := payment.NewBillingHandler(st)
	if paymentHandler.Enabled() {
		http.HandleFunc("/billing/customer", cors(srv.authMiddleware(paymentHandler.HandleCreateCustomer)))
		http.HandleFunc("/billing/setup-intent", cors(srv.authMiddleware(paymentHandler.HandleCreateSetupIntent)))
		http.HandleFunc("/billing/verify-payment", cors(srv.authMiddleware(paymentHandler.HandleVerifyPayment)))
		http.HandleFunc("/billing/payment-methods", cors(srv.authMiddleware(func(w http.ResponseWriter, r *http.Request) {
			userID, _ := r.Context().Value(userIDKey).(string)
			q := r.URL.Query()
			q.Set("user_id", userID)
			r.URL.RawQuery = q.Encode()
			paymentHandler.HandleListPaymentMethods(w, r)
		})))
		http.HandleFunc("/billing/track-usage", cors(srv.authMiddleware(paymentHandler.HandleTrackUsage)))
		http.HandleFunc("/billing/charge", cors(srv.authMiddleware(paymentHandler.HandleCharge)))
		http.HandleFunc("/billing/usage", cors(srv.authMiddleware(func(w http.ResponseWriter, r *http.Request) {
			userID, _ := r.Context().Value(userIDKey).(string)
			q := r.URL.Query()
			q.Set("user_id", userID)
			r.URL.RawQuery = q.Encode()
			paymentHandler.HandleGetUsage(w, r)
		})))
		http.HandleFunc("/billing/webhook", cors(paymentHandler.HandleWebhook)) // webhook has its own signature verification
		log.Println("payment: Razorpay PAYG billing (card+UPI) — /billing/*")
	} else {
		log.Println("payment: billing disabled — set RAZORPAY_KEY_ID to enable")
	}

	log.Printf("HTTP server listening on %s", apiAddr)
	if err := http.ListenAndServe(apiAddr, nil); err != nil {
		log.Fatalf("http server failed: %v", err)
	}
}

func (s *Server) handleAgentHeartbeat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := r.Context().Value(userIDKey).(string)
	if !ok || userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var hb HeartbeatPayload
	if err := json.NewDecoder(r.Body).Decode(&hb); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	if hb.NodeID == "" {
		http.Error(w, "node_id required", http.StatusBadRequest)
		return
	}
	if hb.Status == "" {
		hb.Status = "idle"
	}
	if hb.Owner == "" {
		hb.Owner = userID
	}

	ctx := r.Context()
	if err := s.st.SetNode(ctx, hb.NodeID, hb.Status, hb.Owner); err != nil {
		log.Printf("heartbeat: failed to set node state for %s: %v", hb.NodeID, err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

type contextKey string

const userIDKey contextKey = "user_id"

func sanitizeJobID(id string) string {
	id = filepath.Base(id)
	if id == "" || id == "." || id == ".." || strings.ContainsAny(id, "/\\") {
		return ""
	}
	return id
}

func extractToken(r *http.Request) string {
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		return strings.TrimSpace(authHeader[7:])
	}
	if token := r.Header.Get("X-API-Key"); token != "" {
		return token
	}
	return ""
}

func (s *Server) authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := extractToken(r)
		if token == "" {
			http.Error(w, "missing auth token", http.StatusUnauthorized)
			return
		}
		userID, err := s.validateAuth(token)
		if err != nil {
			http.Error(w, "unauthorized: "+err.Error(), http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), userIDKey, userID)
		next(w, r.WithContext(ctx))
	}
}

func (s *Server) requireJobOwner(next func(http.ResponseWriter, *http.Request, string)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, ok := r.Context().Value(userIDKey).(string)
		if !ok || userID == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var jobID string
		switch {
		case strings.HasPrefix(r.URL.Path, "/storage/upload/"):
			jobID = strings.TrimPrefix(r.URL.Path, "/storage/upload/")
		case strings.HasPrefix(r.URL.Path, "/storage/result-upload/"):
			jobID = strings.TrimPrefix(r.URL.Path, "/storage/result-upload/")
		case strings.HasPrefix(r.URL.Path, "/storage/result/"):
			jobID = strings.TrimPrefix(r.URL.Path, "/storage/result/")
		case strings.HasPrefix(r.URL.Path, "/jobs/"):
			jobID = strings.TrimPrefix(r.URL.Path, "/jobs/")
		}
		jobID = sanitizeJobID(jobID)
		if jobID == "" {
			http.Error(w, "invalid job id", http.StatusBadRequest)
			return
		}

		ctx := r.Context()
		owner, err := s.st.JobGet(ctx, jobID, "owner")
		if err != nil || owner == "" {
			http.Error(w, "job not found", http.StatusNotFound)
			return
		}
		if owner != userID {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}

		next(w, r, jobID)
	}
}

func cors(next http.HandlerFunc) http.HandlerFunc {
	allowedOrigins := getEnv("ALLOWED_ORIGINS", "https://tenxo.onrender.com")
	origins := strings.Split(allowedOrigins, ",")
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowed := ""
		for _, o := range origins {
			if strings.TrimSpace(o) == origin || allowedOrigins == "*" {
				allowed = origin
				break
			}
		}
		if allowed == "" && len(origins) > 0 {
			allowed = strings.TrimSpace(origins[0])
		}
		if allowed != "" {
			w.Header().Set("Access-Control-Allow-Origin", allowed)
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-API-Key")
		w.Header().Set("Vary", "Origin")

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

	userID, ok := r.Context().Value(userIDKey).(string)
	if !ok || userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
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

	// Server-generated jobID — client-provided ID is ignored to prevent hijacking
	jobID := fmt.Sprintf("job-%d", time.Now().UnixNano())

	ctx := context.Background()

	// Merge new fields into existing job hash (don't blow away presign data)
	updates := map[string]string{
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
	_ = s.st.JobSet(ctx, jobID, updates)

	// Fetch result_upload_url (set by presign or from env default)
	resultUploadURL, _ := s.st.JobGet(ctx, jobID, "result_upload_url")
	if resultUploadURL == "" {
		// If no presign was done, build a default result upload URL
		public := getEnv("PUBLIC_API_URL", "http://localhost:8080")
		resultUploadURL = fmt.Sprintf("%s/storage/result-upload/%s", public, jobID)
		_ = s.st.JobSet(ctx, jobID, map[string]string{"result_upload_url": resultUploadURL})
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

	userID, ok := r.Context().Value(userIDKey).(string)
	if !ok || userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	nodeMap, err := s.st.GetAllNodes(ctx)
	if err != nil {
		http.Error(w, "failed to list nodes", http.StatusInternalServerError)
		return
	}

	nodes := make([]NodeInfo, 0, len(nodeMap))
	for _, n := range nodeMap {
		nodes = append(nodes, NodeInfo{
			NodeID: n.NodeID,
			Status: n.Status,
			TTL:    n.TTL,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"nodes": nodes})
}

func (s *Server) handleMyNodes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := r.Context().Value(userIDKey).(string)
	if !ok || userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	ctx := r.Context()
	nodeMap, err := s.st.GetNodesByOwner(ctx, userID)
	if err != nil {
		http.Error(w, "failed to list nodes", http.StatusInternalServerError)
		return
	}

	nodes := make([]NodeInfo, 0, len(nodeMap))
	for _, n := range nodeMap {
		nodes = append(nodes, NodeInfo{
			NodeID: n.NodeID,
			Status: n.Status,
			TTL:    n.TTL,
		})
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
	allowedOrigin := getEnv("ALLOWED_ORIGINS", "https://tenxo.onrender.com")
	signalStore = signaling.NewSessionStore(allowedOrigin)
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

		if err := s.st.SetNode(ctx, hb.NodeID, hb.Status, hb.Owner); err != nil {
			log.Printf("failed to update node state for %s: %v", hb.NodeID, err)
			return
		}

		log.Printf("node %s updated to %s", hb.NodeID, hb.Status)
	})
	if err != nil {
		log.Fatalf("failed to subscribe to heartbeats: %v", err)
	}
	log.Printf("subscribed to heartbeats.> and tracking node state in PostgreSQL")
}

func (s *Server) validateAuth(token string) (string, error) {
	if token == "" {
		return "", errors.New("empty token")
	}

	h := sha256.Sum256([]byte(token))
	hexk := hex.EncodeToString(h[:])
	ctx := context.Background()
	if uid, err := s.st.GetAPIKeyUser(ctx, hexk); err == nil {
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

	userID, ok := r.Context().Value(userIDKey).(string)
	if !ok || userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
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

	// Server-generated jobID — client-provided ID is ignored to prevent hijacking
	jobID := fmt.Sprintf("job-%s", uuid.New().String()[:8])

	ctx := context.Background()
	uploadURL, resultUploadURL, resultURL, err := s.getUploadURLs(ctx, jobID)
	if err != nil {
		http.Error(w, "failed to create presigned URLs: "+err.Error(), http.StatusInternalServerError)
		return
	}

	_ = s.st.JobSet(ctx, jobID, map[string]string{
		"owner":             userID,
		"status":            "created",
		"upload_url":        uploadURL,
		"result_upload_url": resultUploadURL,
		"result_url":        resultURL,
		"enc_key_b64":       keyB64,
	})

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
	userID, ok := r.Context().Value(userIDKey).(string)
	if !ok || userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	rawID := strings.TrimPrefix(r.URL.Path, "/storage/upload/")
	jobID := sanitizeJobID(rawID)
	if jobID == "" {
		http.Error(w, "invalid job id", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	owner, err := s.st.JobGet(ctx, jobID, "owner")
	if err != nil || owner == "" {
		http.Error(w, "job not found", http.StatusNotFound)
		return
	}
	if owner != userID {
		http.Error(w, "forbidden", http.StatusForbidden)
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

	r.Body = http.MaxBytesReader(w, r.Body, 512<<20) // 512 MB max upload

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

	_ = s.st.JobSet(ctx, jobID, map[string]string{"status": "uploaded", "upload_path": filePath})
	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleStorageResultUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut && r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := r.Context().Value(userIDKey).(string)
	if !ok || userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	rawID := strings.TrimPrefix(r.URL.Path, "/storage/result-upload/")
	jobID := sanitizeJobID(rawID)
	if jobID == "" {
		http.Error(w, "invalid job id", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	owner, err := s.st.JobGet(ctx, jobID, "owner")
	if err != nil || owner == "" {
		http.Error(w, "job not found", http.StatusNotFound)
		return
	}
	if owner != userID {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	uploadsDir := getEnv("UPLOADS_DIR", "uploads")
	_ = os.MkdirAll(uploadsDir, 0o755)
	r.Body = http.MaxBytesReader(w, r.Body, 512<<20) // 512 MB max upload
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

	_ = s.st.JobSet(ctx, jobID, map[string]string{"status": "result_uploaded", "result_path": filePath})
	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleStorageGet(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := r.Context().Value(userIDKey).(string)
	if !ok || userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	rawID := strings.TrimPrefix(r.URL.Path, "/storage/result/")
	jobID := sanitizeJobID(rawID)
	if jobID == "" {
		http.Error(w, "invalid job id", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	data, err := s.st.JobGetAll(ctx, jobID)
	if err != nil || len(data) == 0 {
		http.Error(w, "unknown job id", http.StatusNotFound)
		return
	}

	owner, ok := data["owner"]
	if !ok || owner == "" || owner != userID {
		http.Error(w, "forbidden", http.StatusForbidden)
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

	userID, ok := r.Context().Value(userIDKey).(string)
	if !ok || userID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	rawPath := strings.TrimPrefix(r.URL.Path, "/jobs/")
	if strings.HasSuffix(rawPath, "/status") {
		rawPath = strings.TrimSuffix(rawPath, "/status")
	}
	jobID := sanitizeJobID(strings.Trim(rawPath, "/"))
	if jobID == "" {
		http.Error(w, "invalid job id", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	data, err := s.st.JobGetAll(ctx, jobID)
	if err != nil || len(data) == 0 {
		http.Error(w, "unknown job id", http.StatusNotFound)
		return
	}

	owner, ok := data["owner"]
	if !ok || owner == "" || owner != userID {
		http.Error(w, "forbidden", http.StatusForbidden)
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
		if jobID != "" {
			if status != "" {
				_ = s.st.JobSet(ctx, jobID, map[string]string{"status": status})
			}
			if resultURL != "" {
				_ = s.st.JobSet(ctx, jobID, map[string]string{"result_url": resultURL})
			}
			owner, _ := s.st.JobGet(ctx, jobID, "owner")
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
	allowedOrigin := getEnv("ALLOWED_ORIGINS", "https://tenxo.onrender.com")
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			origin := r.Header.Get("Origin")
			if origin == "" || allowedOrigin == "*" {
				return true
			}
			for _, o := range strings.Split(allowedOrigin, ",") {
				if strings.TrimSpace(o) == origin {
					return true
				}
			}
			return false
		},
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w, "upgrade failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Authenticate via first message: {"type":"auth","token":"..."}
	_, msg, err := conn.ReadMessage()
	if err != nil {
		conn.Close()
		return
	}
	var authMsg struct {
		Type  string `json:"type"`
		Token string `json:"token"`
	}
	if err := json.Unmarshal(msg, &authMsg); err != nil || authMsg.Type != "auth" || authMsg.Token == "" {
		conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"auth_error","error":"invalid auth message"}`))
		conn.Close()
		return
	}

	userID, err := s.validateAuth(authMsg.Token)
	if err != nil {
		conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"auth_error","error":"unauthorized"}`))
		conn.Close()
		return
	}

	conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"auth_ok"}`))

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
