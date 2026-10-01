package main

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "os"
    "strings"
    "time"

    "github.com/go-redis/redis/v9"
    "github.com/nats-io/nats.go"
)

type Server struct {
    nc  *nats.Conn
    js  nats.JetStreamContext
    rdb *redis.Client
}

type JobRequest struct {
    EncryptedJobLink string `json:"encrypted_job_link"`
    JobLink          string `json:"job_link"`
}

type HeartbeatPayload struct {
    NodeID string `json:"node_id"`
    Status string `json:"status"`
}

type NodeInfo struct {
    NodeID string `json:"node_id"`
    Status string `json:"status"`
    TTL    int64  `json:"ttl_seconds"`
}

func main() {
    natsURL := getEnv("NATS_URL", nats.DefaultURL)
    redisAddr := getEnv("REDIS_ADDR", "localhost:6379")
    redisPassword := os.Getenv("REDIS_PASSWORD")
    streamName := getEnv("NATS_STREAM", "JOB_STREAM")

    log.Printf("Starting matchmaker: NATS=%s Redis=%s", natsURL, redisAddr)

    rdb := redis.NewClient(&redis.Options{
        Addr:     redisAddr,
        Password: redisPassword,
        DB:       0,
    })

    if err := rdb.Ping(context.Background()).Err(); err != nil {
        log.Fatalf("redis ping failed: %v", err)
    }

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

    srv := &Server{nc: nc, js: js, rdb: rdb}
    go srv.listenHeartbeats(context.Background())

    http.HandleFunc("/jobs", srv.handleJobs)
    http.HandleFunc("/nodes", srv.handleNodes)
    http.HandleFunc("/health", handleHealth)

    addr := getEnv("API_ADDR", ":8080")
    log.Printf("HTTP server listening on %s", addr)
    if err := http.ListenAndServe(addr, nil); err != nil {
        log.Fatalf("http server failed: %v", err)
    }
}

func getEnv(key, fallback string) string {
    if value := os.Getenv(key); value != "" {
        return value
    }
    return fallback
}

func ensureStream(js nats.JetStreamContext, name string) error {
    _, err := js.StreamInfo(name)
    if err == nil {
        return nil
    }
    if err == nats.ErrStreamNotFound {
        _, err = js.AddStream(&nats.StreamConfig{
            Name:     name,
            Subjects: []string{"jobs"},
            Storage:  nats.FileStorage,
            Retention: nats.WorkQueuePolicy,
        })
    }
    return err
}

func (s *Server) handleJobs(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
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

    msgData, err := json.Marshal(map[string]string{"encrypted_job_link": jobLink})
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

func handleHealth(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    _ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
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
        log.Printf("node %s updated to %s", hb.NodeID, hb.Status)
    })
    if err != nil {
        log.Fatalf("failed to subscribe to heartbeats: %v", err)
    }
    log.Printf("subscribed to heartbeats.> and tracking node state in Redis")
}
