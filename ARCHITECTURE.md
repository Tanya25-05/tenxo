# Tenxo — Zero-Trust GPU Grid Architecture

```
                    +---------+       +------------+       +------------+
                    |  Client |       | Matchmaker |       |    GPU     |
                    | (Alice) |       |  (Go HTTP) |       |  Provider  |
                    +---------+       +------------+       +------------+
                         |                   |                   |
    1. pip install tenxo |                   |                   |
    2. tenxo run payload |                   |                   |
       ─────────────────>|                   |                   |
       POST /presign     |                   |                   |
       <─────── URLs ────|                   |                   |
       PUT <upload_url>  |                   |                   |
       ──────────────────|──────────────────>|                   |
                         |  (stores .enc)    |                   |
       POST /signal/session                  |                   |
       ─────────────────────────────────────>|                   |
                         |                   |  creates session  |
                         |                   |   (blinded keys)  |
       GET /signal/session?id=               |                   |
       <── session_id, salt ──────────────── |                   |
                         |                   |                   |
       (Alice generates ephemeral keypair)   |                   |
       XOR(AES_key, ECDH_shared_secret)      |                   |
       ─────────────────────────────────────>|                   |
       POST /signal/client-key               |                   |
                         |                   |  routes to agent  |
                         |                   |──────────────────>|
                         |                   |  via WebSocket    |
                         |                   |                   |
                         |                   |   Agent XORs back |
                         |                   |   with its ECDH   |
                         |                   |   private key     |
                         |                   |   → recovers      |
                         |                   |     AES-GCM key   |
                         |                   |                   |
                         |  6. agent downloads encrypted payload |
                         |<──────────────────────────────────────|
                         |  7. agent decrypts → processes →      |
                         |     re-encrypts → uploads result      |
                         |  8. client polls GET /jobs/<id>       |
                         |  Alice downloads and decrypts result  |
```

## Zero-Knowledge Principle

The matchmaker **never sees** the AES-GCM encryption key. Only the computed
`AES_key XOR ECDH_shared_secret` is passed through it. Since ECDH key agreement
matches two ephemeral keys to produce a 32-byte shared secret, and the
matchmaker knows neither private key, it cannot recover the AES key.

```
                         ┌──────────────────────┐
                         │      Matchmaker       │
                         │  Sees only XOR'd key  │
                         │  Knows neither privkey│
                         └──────────────────────┘
                               ▲            ▲
                               │            │
               XOR(AES, ECDH)  │            │  XOR'd key
                               │            │
                         ┌─────┴────┐  ┌────┴─────┐
                         │  Alice   │  │   Bob    │
                         │ (Client) │  │  (Agent) │
                         └──────────┘  └──────────┘
```

## End-to-End Flows

### 1. Client → Frontend Dashboard (Web)

```
Browser ──GET /────> Vercel (Next.js) ──API──> Render (Go matchmaker) ──> Redis
                                                    │
                                                    ├──NATS──> GPU Agent
                                                    │
                                               Stripe ◄── billing.tenxo.ai
```

### 2. Client → CLI → Grid

```
Alice's Machine                  Matchmaker                     GPU Provider
─────────────────               ───────────                    ─────────────
tenxo run workflow.tar.gz
  │                                  │                              │
  ├── POST /presign ───────────────► │  returns upload URLs         │
  ├── encrypt with AES-256-GCM      │                              │
  ├── PUT /storage/upload ─────────►│  stores encrypted blob       │
  ├── POST /signal/session ────────►│  creates blinded session     │
  ├── generate ECDH keypair         │                              │
  ├── XOR(enc_key, ECDH_secret)     │                              │
  ├── POST /signal/client-key ─────►│── WebSocket ────────────────►│
  │                                  │                              │
  │                                  │         agent has private    │
  │                                  │         key → XORs back      │
  │                                  │         → recovers AES key   │
  │                                  │                              │
  │                                  │◄── agent downloads .enc ─────│
  │                                  │    decrypts → runs in Docker │
  │                                  │    re-encrypts result        │
  │                                  │◄── PUT /storage/result ──────│
  │                                  │                              │
  ├── GET /jobs/<id> (poll) ───────►│  status: result_uploaded     │
  ├── GET /storage/result ─────────►│  downloads encrypted result  │
  ├── decrypt with AES key          │                              │
  └── workflow_output.tar.gz ◄──────┘                              ┘
```

### 3. GPU Provider Onboarding

```
1. sudo apt install docker.io nvidia-driver-545
2. curl -fsSL https://tenxo.ai/install.sh | sudo bash
3. systemctl edit --full tenxo-agent   # set OWNER=<your-id>
4. sudo systemctl restart tenxo-agent

    Agent starts:
        ┌──────────────────────┐
        │  Edge Agent (Rust)   │
        │                      │
        │  1. Generate ECDH    │
        │     keypair          │
        │  2. WS /signal/agent │
        │     → tee_quote      │
        │     → agent_pub_key  │
        │  3. Wait for job     │
        │  4. Download .enc    │
        │  5. Decrypt with     │
        │     AES-GCM          │
        │  6. Extract ZIP      │
        │  7. Docker run       │
        │     --network none   │
        │     --cap-drop ALL   │
        │  8. Re-encrypt       │
        │  9. Upload result    │
        └──────────────────────┘
```

### 4. Payment Flow (Stripe)

```
User clicks "Buy Credits"
        │
        ▼
Frontend POST /billing/checkout { user_id, amount_cents }
        │
        ▼
Stripe Checkout Session (redirects to stripe.com)
        │
        ▼
User completes payment
        │
        ▼
Stripe POST /billing/webhook (checkout.session.completed)
        │
        ▼
Redis HINCRBY credits:<user_id> gpu_hours <hours>
        │
        ▼
User now has GPU hours — jobs can be submitted
```

## Component Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (Vercel)                     │
│  Next.js + Supabase Auth + Tailwind                      │
│  Pages: Developer Console, Provider Console, Landing     │
├──────────────────────────────────────────────────────────┤
│                    MATCHMAKER (Render)                   │
│  Go 1.24 HTTP Server                                     │
│  ├── POST /jobs          — submit job                    │
│  ├── GET  /jobs/:id      — poll job status               │
│  ├── GET  /nodes         — list online nodes             │
│  ├── GET  /my-nodes      — provider's own nodes          │
│  ├── POST /presign       — get upload URL                │
│  ├── WS  /ws             — real-time job notifications   │
│  ├── WS  /signal/agent   — agent key exchange            │
│  ├── WS  /signal/client  — client key exchange           │
│  ├── POST /billing/checkout — Stripe checkout session    │
│  ├── POST /billing/webhook  — Stripe payment webhook     │
│  ├── GET  /billing/credits  — user credit balance        │
│  └── storage/upload/*    — local file storage            │
│                                                            │
│  Dependencies: NATS (JetStream), Redis, S3-compatible     │
├──────────────────────────────────────────────────────────┤
│                    GPU AGENT (Bare Metal / VM)            │
│  Rust binary (edge_agent)                                 │
│  ├── ECDH key exchange (x25519-dalek)                    │
│  ├── HKDF-SHA256 key derivation                           │
│  ├── AES-256-GCM encryption/decryption (aes-gcm)         │
│  ├── WebSocket signaling (tungstenite)                   │
│  ├── Docker sandbox (--network none --cap-drop ALL)      │
│  └── Systemd service (auto-restart)                      │
├──────────────────────────────────────────────────────────┤
│                    INFRASTRUCTURE                         │
│  NATS 2.10 — Message queue (+ JetStream persistence)     │
│  Redis 7 — Job state, node registry, credit balance      │
│  Cloudflare R2 — Optional S3-compatible blob storage     │
└──────────────────────────────────────────────────────────┘
```

## Protocol: Transfer Encrypted Blob (TENXO)

### Payload Privacy

All payloads are padded to standard tier sizes before encryption:

| Tier | Padded Size  |
|------|-------------|
| S    | 1 GB        |
| M    | 5 GB        |
| L    | 10 GB       |

This prevents network observers from inferring workload type from ciphertext
size. The matchmaker stores `salt_b64` and routes `client_pub_key_xor` but
never the plain AES key.

### Encryption Scheme

```
EphemeralKeyPair (client)        EphemeralKeyPair (agent)
    ├── priv_key (32B)               ├── priv_key (32B)
    ├── pub_key  (32B)               ├── pub_key  (32B)
    │                                │
    └── ECDH(priv, agent_pub)  ──► shared_secret (32B)
                                   └── HKDF-SHA256(salt, info="tenxo-aes-key")
                                       └── aes_key (32B)
                                           └── AES-256-GCM encrypt(payload)
```

### Zero-Knowledge Key Passing

```
Client does:
    aes_key = HKDF(ECDH(client_priv, agent_pub))
    xor_key = aes_key XOR ECDH(client_priv, agent_pub)
    POST /signal/client-key { xor_key, session_id }

Agent does:
    aes_key = ECDH(agent_priv, client_pub) XOR xor_key
    
Matchmaker sees only: xor_key, client_pub_key, agent_pub_key → cannot compute
either ECDH shared secret (needs at least one private key).
```

## Deployment Options

### Option A: Serverless + Managed (Recommended)

| Service     | Component          | Cost      |
|-------------|-------------------|-----------|
| Vercel      | Frontend (Next.js) | Free      |
| Render      | Backend (Go)       | Free tier |
| Render      | Redis              | Free      |
| Synadia     | NATS Cloud         | Free tier |
| Stripe      | Payments           | 2.9%+fee  |
| Supabase    | Auth + DB          | Free tier |
| Cloudflare R2 | Blob storage    | Free tier |

### Option B: Single VPS ($10-20/mo)

```
docker compose -f deploy/docker-compose.yml up -d
```

Runs NATS, Redis, matchmaker, and frontend all on one machine.

## Directory Structure

```
.
├── backend/                  # Go matchmaker server
│   ├── main.go               # HTTP routes, NATS/Redis clients
│   ├── go.mod / go.sum
│   ├── Dockerfile
│   ├── configs/
│   │   └── nats.conf
│   ├── payment/
│   │   └── stripe.go         # Stripe checkout + webhook
│   └── signaling/
│       └── types.go          # WS session store, agent/client handlers
│
├── frontend/                 # Next.js web app
│   ├── pages/
│   │   ├── index.js          # Landing page
│   │   ├── app/
│   │   │   ├── developer/    # Developer dashboard
│   │   │   └── provider/     # Provider dashboard
│   ├── lib/
│   │   ├── api.js            # API client with env-based URL
│   │   ├── supabaseClient.js # Supabase init
│   │   └── useRequireSession.js
│   └── components/
│
├── tenxo/                    # Python SDK (published to PyPI)
│   ├── tenxo/
│   │   ├── crypto.py         # ECDH, AES-GCM, HKDF, padding, TEE verify
│   │   ├── client.py         # CLI command implementations
│   │   ├── cli.py            # argparse entry point
│   │   └── __init__.py
│   └── pyproject.toml
│
├── edge_agent/               # Rust GPU provider agent
│   ├── src/main.rs           # Full pipeline: WS → decrypt → Docker → encrypt
│   └── Cargo.toml
│
├── deploy/
│   └── docker-compose.yml    # Production stack
│
├── install.sh                # One-command agent installer
├── render.yaml               # Render blueprints config
├── .env.example              # All environment variables
├── docker-compose.yml        # Local dev (NATS + Redis)
├── ARCHITECTURE.md           # This file
└── README.md                 # Project overview
```

## Security Considerations

1. **Zero-Knowledge Routing**: The matchmaker routes encrypted key material
   between client and agent without ever possessing the encryption key.
2. **TEE Attestation**: GPU agents provide an AMD SEV-SNP or Intel TDX quote
   (structural placeholder; real attestation requires `/dev/sev` kernel access).
3. **Plausible Deniability**: All payloads are padded to 1/5/10 GB tiers.
4. **Sandboxed Execution**: Agent runs workloads in Docker with
   `--network none --cap-drop ALL` (no network, no root capabilities).
5. **Forward Secrecy**: Ephemeral ECDH keys are generated per-session and
   discarded after job completion.
6. **Replay Protection**: Each encrypted blob includes a unique salt for HKDF.
