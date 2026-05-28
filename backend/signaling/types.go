// Package signaling implements the Zero-Knowledge key exchange protocol.
// The matchmaker acts ONLY as a transparent router for ephemeral public keys
// and TEE attestation quotes. It NEVER has access to the ECDH shared secret,
// the AES payload key, or any plaintext data.
//
// Protocol:
//
//	Agent ──[WS /signal/agent]──► Matchmaker ──[HTTP relay]──► Client
//	  │                                                           │
//	  ├─ 1. Agent sends TeeQuote (contains AgentPubKey)           │
//	  │    Matchmaker stores quote, assigns SessionID             │
//	  │    Matchmaker returns SessionID                           │
//	  │                                                           │
//	  │              ┌────────────────────────────────────────────┘
//	  │              │ Client connects: WS /signal/client?session=<id>
//	  │              ▼
//	  │     2. Matchmaker routes TeeQuote to Client
//	  │     3. Client verifies TeeQuote (AMD cert chain)
//	  │     4. Client generates ephemeral X25519 keypair
//	  │     5. Client computes ECDH shared secret (LOCAL ONLY)
//	  │     6. Client sends ClientPubKey to Matchmaker
//	  │
//	  ├── Matchmaker routes ClientPubKey to Agent ───────────────►
//	  │     7. Agent computes same ECDH shared secret (LOCAL ONLY)
//	  │     8. Agent derives AES key via HKDF
//	  │                                                           │
//	  │ Both sides now have the same AES-256-GCM payload key.     │
//	  │ The matchmaker saw only opaque key bytes it cannot use.   │
//
//	Security Properties:
//	  - Forward secrecy: ephemeral keys are discarded after job completion
//	  - Zero-knowledge routing: server sees only public key bytes
//	  - Hardware attestation: agent proves it runs inside a TEE
//	  - Key compromise impersonation resistance: ECDH + TEE binding
package signaling

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/nats-io/nats.go"
)

// ─── Types ──────────────────────────────────────────────────────────────────

// TeeQuote is the AMD SEV-SNP attestation report.
// The matchmaker stores and forwards it without interpretation.
type TeeQuote struct {
	ReportDataB64  string   `json:"report_data_b64"`
	MeasurementB64 string   `json:"measurement_b64"`
	ChipIDB64      string   `json:"chip_id_b64"`
	SignatureB64   string   `json:"signature_b64"`
	CertChainB64   []string `json:"cert_chain_b64"`
}

// Session represents one ECDH key exchange session.
type Session struct {
	ID              string          `json:"id"`
	ChallengeNonce  string          `json:"challenge_nonce,omitempty"`
	AgentPubKey     string          `json:"agent_pub_key,omitempty"`
	ClientPubKey    string          `json:"client_pub_key,omitempty"`
	AgentQuote      *TeeQuote       `json:"agent_quote,omitempty"`
	AgentConn       *websocket.Conn `json:"-"`
	ClientConn      *websocket.Conn `json:"-"`
	CreatedAt       time.Time       `json:"created_at"`
	done            chan struct{}
}

func generateChallenge() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.StdEncoding.EncodeToString(b)
}

// WSMessage is the generic WebSocket frame.
type WSMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// ─── Session Store ──────────────────────────────────────────────────────────

// SessionStore holds active key-exchange sessions.
// In production, replace with Redis for horizontal scaling.
type SessionStore struct {
	mu       sync.RWMutex
	sessions map[string]*Session
	upgrader websocket.Upgrader
	nc       *nats.Conn
}

func (ss *SessionStore) SetNATS(nc *nats.Conn) {
	ss.nc = nc
}

// NewSessionStore creates a new session store with a WebSocket upgrader.
func NewSessionStore(allowedOrigin string) *SessionStore {
	return &SessionStore{
		sessions: make(map[string]*Session),
		upgrader: websocket.Upgrader{
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
		},
	}
}

// CreateSession allocates a new session and returns its ID.
func (ss *SessionStore) CreateSession() string {
	ss.mu.Lock()
	defer ss.mu.Unlock()

	id := uuid.New().String()
	ss.sessions[id] = &Session{
		ID:        id,
		CreatedAt: time.Now(),
		done:      make(chan struct{}),
	}
	return id
}

// GetSession retrieves a session by ID.
func (ss *SessionStore) GetSession(id string) (*Session, bool) {
	ss.mu.RLock()
	defer ss.mu.RUnlock()
	s, ok := ss.sessions[id]
	return s, ok
}

// DeleteSession removes a completed or expired session.
func (ss *SessionStore) DeleteSession(id string) {
	ss.mu.Lock()
	defer ss.mu.Unlock()
	delete(ss.sessions, id)
}

// ─── Agent Handler ──────────────────────────────────────────────────────────

// HandleAgentWS handles WebSocket connections from GPU agents.
//
// Flow:
//  1. Matchmaker sends a challenge nonce to the agent
//  2. Agent responds with TeeQuote containing challenge in report_data[32..64]
//  3. Matchmaker verifies the challenge nonce is embedded in the quote
//  4. Matchmaker creates a session, stores the quote, returns session ID
//  5. Agent reads ClientPubKey from the same WebSocket (pushed by HandleClientWS)
//  6. Once ClientPubKey arrives, agent can compute ECDH shared secret
func (ss *SessionStore) HandleAgentWS(w http.ResponseWriter, r *http.Request) {
	conn, err := ss.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("signaling: agent WS upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	// ── Step 1: Issue challenge nonce to agent ────────────────────────
	challenge := generateChallenge()
	challengeMsg, _ := json.Marshal(WSMessage{
		Type: "challenge",
		Payload: mustMarshal(map[string]string{
			"nonce": challenge,
		}),
	})
	if err := conn.WriteMessage(websocket.TextMessage, challengeMsg); err != nil {
		log.Printf("signaling: agent send challenge failed: %v", err)
		return
	}
	log.Printf("signaling: challenge sent to agent (nonce: %.16s...)", challenge)

	// ── Step 2: Agent sends TeeQuote ──────────────────────────────────
	_, raw, err := conn.ReadMessage()
	if err != nil {
		log.Printf("signaling: agent read quote failed: %v", err)
		return
	}

	var msg WSMessage
	if err := json.Unmarshal(raw, &msg); err != nil {
		log.Printf("signaling: agent bad message: %v", err)
		return
	}

	if msg.Type != "tee_quote" {
		log.Printf("signaling: agent expected tee_quote, got %s", msg.Type)
		return
	}

	var quote TeeQuote
	if err := json.Unmarshal(msg.Payload, &quote); err != nil {
		log.Printf("signaling: agent bad quote payload: %v", err)
		return
	}

	// ── Step 3: Verify challenge is embedded in report_data[32..64] ───
	reportData, err := base64.StdEncoding.DecodeString(quote.ReportDataB64)
	if err != nil || len(reportData) != 64 {
		log.Printf("signaling: invalid report_data in quote: len=%d err=%v", len(reportData), err)
		return
	}

	challengeBytes, err := base64.StdEncoding.DecodeString(challenge)
	if err != nil || len(challengeBytes) != 32 {
		log.Printf("signaling: invalid challenge encoding: err=%v", err)
		return
	}

	// report_data[32..64] must match the issued challenge
	embeddedChallenge := reportData[32:64]
	for i, b := range embeddedChallenge {
		if b != challengeBytes[i] {
			log.Printf("signaling: challenge mismatch in report_data[32..64] — possible replay attack")
			conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"error","payload":{"error":"challenge mismatch — attestation rejected"}}`))
			return
		}
	}
	log.Printf("signaling: challenge verified in TEE quote (report_data[32..64] matches issued nonce)")

	// ── Step 4: Create session and store quote ────────────────────────
	sessionID := ss.CreateSession()
	session, _ := ss.GetSession(sessionID)
	session.AgentConn = conn
	session.AgentQuote = &quote
	session.ChallengeNonce = challenge

	log.Printf("signaling: agent session created: %s", sessionID)

	// Send session ID back to agent
	sessionResp, _ := json.Marshal(WSMessage{
		Type: "session_created",
		Payload: mustMarshal(map[string]string{
			"session_id": sessionID,
		}),
	})
	if err := conn.WriteMessage(websocket.TextMessage, sessionResp); err != nil {
		log.Printf("signaling: agent send session failed: %v", err)
		ss.DeleteSession(sessionID)
		return
	}

	// ── Step 5: Read ClientPubKey (pushed by HandleClientWS) ─────────
	// The client connects via HandleClientWS, receives the TeeQuote,
	// verifies it, and sends back its ephemeral pubkey. HandleClientWS
	// pushes that pubkey to this open WebSocket.
	conn.SetReadDeadline(time.Now().Add(5 * time.Minute))
	_, raw, err = conn.ReadMessage()
	if err != nil {
		log.Printf("signaling: agent read client pubkey failed (%s): %v", sessionID, err)
		ss.DeleteSession(sessionID)
		return
	}

	var keyMsg WSMessage
	if err := json.Unmarshal(raw, &keyMsg); err != nil {
		log.Printf("signaling: agent bad client key message (%s): %v", sessionID, err)
		ss.DeleteSession(sessionID)
		return
	}

	if keyMsg.Type != "client_pub_key" {
		log.Printf("signaling: agent expected client_pub_key, got %s (%s)", keyMsg.Type, sessionID)
		ss.DeleteSession(sessionID)
		return
	}

	log.Printf("signaling: agent received client pubkey for session %s", sessionID)
	ss.DeleteSession(sessionID)

	// ── Step 6: Persistent bridge mode: WS ↔ NATS ────────────────────
	// After key exchange, the WebSocket stays open and acts as a NATS
	// proxy for this agent. This avoids exposing the NATS port to the
	// internet — agents communicate entirely through port 8080.
	if ss.nc == nil {
		log.Printf("signaling: no NATS available, closing agent WS %s", sessionID)
		return
	}

	nodeID := sessionID

	sub, err := ss.nc.Subscribe("jobs", func(m *nats.Msg) {
		if err := conn.WriteMessage(websocket.TextMessage, m.Data); err != nil {
			log.Printf("signaling: write job to WS failed (%s): %v", sessionID, err)
		}
	})
	if err != nil {
		log.Printf("signaling: subscribe jobs failed (%s): %v", sessionID, err)
		return
	}
	defer sub.Unsubscribe()

	log.Printf("signaling: agent %s entering bridge mode", sessionID)

	for {
		_, raw, err := conn.ReadMessage()
		if err != nil {
			log.Printf("signaling: agent WS disconnected (%s): %v", sessionID, err)
			break
		}

		var wsMsg WSMessage
		if err := json.Unmarshal(raw, &wsMsg); err != nil {
			log.Printf("signaling: agent bad WS message (%s): %v", sessionID, err)
			continue
		}

		switch wsMsg.Type {
		case "heartbeat":
			var hb struct {
				NodeID string `json:"node_id"`
			}
			if err := json.Unmarshal(wsMsg.Payload, &hb); err == nil && hb.NodeID != "" {
				nodeID = hb.NodeID
			}
			ss.nc.Publish("heartbeats."+nodeID, wsMsg.Payload)
		case "result":
			ss.nc.Publish("jobs.results", wsMsg.Payload)
		default:
			log.Printf("signaling: unknown WS message type from agent (%s): %s", sessionID, wsMsg.Type)
		}
	}
}

// ─── Client Handler ─────────────────────────────────────────────────────────

// HandleClientWS handles WebSocket connections from developer CLI clients.
//
// Flow:
//  1. Client connects with session ID from query parameter
//  2. Matchmaker routes the agent's TeeQuote to the client
//  3. Client verifies the TEE quote, computes ECDH secret (locally)
//  4. Client sends its ephemeral X25519 pubkey to matchmaker
//  5. Matchmaker routes ClientPubKey to the agent
func (ss *SessionStore) HandleClientWS(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("session")
	if sessionID == "" {
		http.Error(w, "missing session query parameter", http.StatusBadRequest)
		return
	}

	session, ok := ss.GetSession(sessionID)
	if !ok {
		http.Error(w, "session not found", http.StatusNotFound)
		return
	}

	conn, err := ss.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("signaling: client WS upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	session.ClientConn = conn

	// ── Step 1: Route TeeQuote to client ─────────────────────────────
	quotePayload, _ := json.Marshal(session.AgentQuote)
	quoteMsg, _ := json.Marshal(WSMessage{
		Type:    "tee_quote",
		Payload: quotePayload,
	})
	if err := conn.WriteMessage(websocket.TextMessage, quoteMsg); err != nil {
		log.Printf("signaling: client send quote failed: %v", err)
		return
	}

	// ── Step 2: Wait for ClientPubKey ────────────────────────────────
	_, raw, err := conn.ReadMessage()
	if err != nil {
		log.Printf("signaling: client read pubkey failed: %v", err)
		return
	}

	var msg WSMessage
	if err := json.Unmarshal(raw, &msg); err != nil {
		log.Printf("signaling: client bad message: %v", err)
		return
	}

	if msg.Type != "client_pub_key" {
		log.Printf("signaling: client expected client_pub_key, got %s", msg.Type)
		return
	}

	var payload struct {
		PubKey string `json:"pub_key"`
	}
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		log.Printf("signaling: client bad pubkey payload: %v", err)
		return
	}

	session.ClientPubKey = payload.PubKey

	// ── Step 3: Route ClientPubKey to agent ──────────────────────────
	routeMsg, _ := json.Marshal(WSMessage{
		Type: "client_pub_key",
		Payload: mustMarshal(map[string]string{
			"pub_key": payload.PubKey,
		}),
	})
	if session.AgentConn != nil {
		if err := session.AgentConn.WriteMessage(websocket.TextMessage, routeMsg); err != nil {
			log.Printf("signaling: route client key to agent failed: %v", err)
		}
	}

	// Signal the agent's wait loop to complete
	close(session.done)

	log.Printf("signaling: ECDH key exchange complete for session %s", sessionID)
}

// ─── REST Endpoint: Create Session (alternative to WS) ─────────────────────

// HandleCreateSession is a REST endpoint that creates a session from an agent's
// initial HTTP request (alternative to the full WebSocket flow).
func (ss *SessionStore) HandleCreateSession(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		AgentPubKey string   `json:"agent_pub_key"`
		Quote       TeeQuote `json:"quote"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	sessionID := ss.CreateSession()
	session, _ := ss.GetSession(sessionID)
	session.AgentPubKey = req.AgentPubKey
	session.AgentQuote = &req.Quote

	// In the REST flow, the client polls for the agent's quote and posts
	// its pubkey. There's no real-time agent notification — the agent
	// must poll or maintain a long-lived connection.

	log.Printf("signaling: REST session created: %s", sessionID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"session_id": sessionID,
	})
}

// HandleGetSession is a REST endpoint for the CLI client to fetch agent details.
func (ss *SessionStore) HandleGetSession(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Query().Get("session")
	if sessionID == "" {
		http.Error(w, "missing session", http.StatusBadRequest)
		return
	}

	session, ok := ss.GetSession(sessionID)
	if !ok {
		http.Error(w, "session not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"session_id": session.ID,
		"quote":      session.AgentQuote,
	})
}

// HandlePostClientKey is a REST endpoint for the CLI client to submit its pubkey.
func (ss *SessionStore) HandlePostClientKey(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	sessionID := r.URL.Query().Get("session")
	if sessionID == "" {
		http.Error(w, "missing session", http.StatusBadRequest)
		return
	}

	var req struct {
		PubKey string `json:"pub_key"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	session, ok := ss.GetSession(sessionID)
	if !ok {
		http.Error(w, "session not found", http.StatusNotFound)
		return
	}

	session.ClientPubKey = req.PubKey
	close(session.done)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "key_received"})
}

// ─── Utilities ──────────────────────────────────────────────────────────────

func mustMarshal(v interface{}) json.RawMessage {
	data, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return data
}
