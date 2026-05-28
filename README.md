# Tenxo — Zero-Knowledge Decentralized GPU Grid

A distributed GPU compute marketplace with E2EE execution inside TEEs.
The matchmaker routes **only public keys** — it never sees the AES payload key, the ECDH shared secret, or the plaintext workload.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                            Flow                                     │
│                                                                     │
│   Client                        Matchmaker                Agent     │
│     │                              │                       │        │
│     │  1. Register Session         │                       │        │
│     │◄─────────────────────────────│                       │        │
│     │                              │ 2. Agent connects     │        │
│     │                              │◄──────────────────────│        │
│     │  3. Agent's TEE Quote        │                       │        │
│     │◄─────────────────────────────│                       │        │
│     │  4. Verify Quote, send       │                       │        │
│     │     ClientPubKey             │                       │        │
│     │─────────────────────────────►│  5. Forward PubKey    │        │
│     │                              │──────────────────────►│        │
│     │                              │  6. Compute ECDH,     │        │
│     │                              │     store AES key     │        │
│     │  7. Submit job (salt only,   │                       │        │
│     │     NOT AES key)             │                       │        │
│     │─────────────────────────────►│  8. Forward job       │        │
│     │                              │──────────────────────►│        │
│     │                              │  9. Derive AES key    │        │
│     │                              │     via HKDF(salt),   │        │
│     │                              │     decrypt, execute, │        │
│     │                              │     re-encrypt result │        │
│     │ 10. Download result          │                       │        │
│     │◄─────────────────────────────│                       │        │
│     │ 11. Decrypt with client-side │                       │        │
│     │     AES key                  │                       │        │
│     │                              │                       │        │
└─────────────────────────────────────────────────────────────────────┘
```

### Key properties
- **Matchmaker is zero-knowledge**: routes AgentPubKey and ClientPubKey but computes no crypto operations
- **ECDH shared secret** is derived client-side and agent-side only — never transmitted
- **AES payload key** = HKDF-SHA256(ECDH_shared_secret, per-job_salt) — fresh per job
- **Payloads padded** to uniform tier sizes (1/5/10 GB) for plausible deniability
- **TEE attestation**: agent proves it runs inside AMD SEV-SNP / Intel TDX before client sends pubkey

## Components

| Component | Language | Location | Role |
|-----------|----------|----------|------|
| **Matchmaker** | Go | `backend/` | Session routing, job queue (NATS) |
| **Edge Agent** | Rust | `edge_agent/` | In-TEE execution, key derivation |
| **CLI/SDK** | Python | `tenxo/` | Key generation, encryption, job submission |

## Quick Start

```bash
# 1. Start infrastructure (NATS + Redis)
docker compose up -d

# 2. Start matchmaker (port :8080)
cd backend && go run main.go

# 3. Edge agent connects, registers TEE quote via WebSocket
cd edge_agent && cargo run --release

# 4. Python CLI — submit a job
python -m tenxo.cli run ./my_work_dir --api-url http://localhost:8080 --api-key <your_key>
```

## Full Project Execution

```bash
# Terminal 1 — infrastructure
docker compose up -d

# Terminal 2 — matchmaker
cd backend && go run main.go          # listens on :8080

# Terminal 3 — edge agent (GPU provider)
cd edge_agent && NATS_URL=nats://localhost:4222 \
    MATCHMAKER_URL=http://localhost:8080 \
    OWNER=<your_user_id> \
    cargo run --release

# Terminal 4 — client submit a job
cd tenxo && pip install -e . && \
    python -m tenxo.cli run ./my_work \
    --api-url http://localhost:8080 \
    --api-key dev-local-abc123
```

Register a test API key in PostgreSQL:

```bash
# Hash the key with SHA-256
echo -n "dev-local-abc123" | sha256sum
# Returns a hex hash; let's say it's abc123...
# Then insert it into PostgreSQL:
docker compose exec postgres psql -U postgres -d tenxo -c \
  "INSERT INTO api_keys (key_hash, user_id) VALUES ('<hex_hash>', 'local-dev-user') ON CONFLICT DO NOTHING;"
```

## Cryptographic Protocol

1. **Client** generates ephemeral X25519 keypair
2. **Agent** generates ephemeral X25519 keypair, sends TEE quote to client via matchmaker
3. **Client** verifies quote against AMD cert chain, then sends ClientPubKey to agent
4. **Both** compute ECDH shared secret
5. **Client** derives AES key = HKDF(shared_secret, salt), encrypts payload, pads to tier
6. **Client** submits salt (not AES key) via matchmaker to agent
7. **Agent** derives same AES key, decrypts inside TEE, executes via Docker, re-encrypts result

## API

### Signaling (WebSocket + REST)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| WS | `/signal/agent` | Agent registers with TEE quote |
| WS | `/signal/client` | Client receives quote, sends pubkey |
| POST | `/signal/session` | Create session (REST fallback) |
| GET | `/signal/session/:id` | Get session status |
| POST | `/signal/session/:id/client-key` | Submit client key (REST) |

### Jobs (NATS)

| Subject | Schema | Purpose |
|---------|--------|---------|
| `jobs.submit` | `{session_id, salt_b64, encrypted_payload_link}` | Submit encrypted job |
| `jobs.result` | `{session_id, encrypted_result_link}` | Notification of completed job |

## Registering a GPU Node (Edge Agent Onboarding)

GPU providers run the Rust edge agent on their machine. Here's what's needed:

### Prerequisites (on the provider machine)

| Requirement | Version | Notes |
|-------------|---------|-------|
| Linux (Ubuntu 22.04+) | — | WSL2 works for local dev |
| NVIDIA GPU | — | Tested on A100, V100, RTX 4090 |
| nvidia-container-toolkit | latest | Required for `--gpus all` in Docker |
| Docker | 24+ | With nvidia runtime configured |
| Rust toolchain | 1.75+ | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh` |
| Network | — | Outbound to matchmaker NATS (4222) and HTTP (8080) |

### What files the agent needs

All you need is the `edge_agent/` directory. Build with:

```bash
git clone <repo-url>
cd GPU_grid/edge_agent
cargo build --release
sudo ./target/release/edge_agent
```

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `NATS_URL` | `nats://127.0.0.1:4222` | Matchmaker NATS address |
| `MATCHMAKER_URL` | `http://127.0.0.1:8080` | Matchmaker HTTP address (for WS signaling) |
| `OWNER` | `""` | Your user/account ID (matched via Redis API key) |
| `NODE_ID` | `node-<uuid>` | Unique node identifier (auto-generated if empty) |
| `JOBS_SUBJECT` | `jobs` | NATS subject to subscribe for job messages |
| `RESULT_SUBJECT` | `jobs.results` | NATS subject to publish job results |

### Registration flow

1. The matchmaker operator gives you the `NATS_URL` and `MATCHMAKER_URL`
2. Your API key is registered in Redis by the operator
3. Set `OWNER=<your_user_id>` matching the API key
4. Start the agent — it connects to the matchmaker, generates an ephemeral X25519 keypair, and begins broadcasting heartbeats
5. The matchmaker lists your node in `GET /nodes` and routes jobs to it

### What the agent does (zero-trust)

- **Never stores plaintext**: downloads encrypted blobs, decrypts IN-MEMORY inside the TEE
- **No persistent state**: ephemeral keys, fresh per instance
- **Sandboxed execution**: Docker `--network none --cap-drop ALL --security-opt no-new-privileges:true`
- **Plausible deniability**: all payloads are tier-padded; you only know the tier size (1/5/10 GB)

## Security Model

- **Plausible deniability**: all payloads padded to standard tier size
- **Zero-trust matchmaker**: sees only public keys and routing metadata
- **In-TEE execution**: decrypt → execute → re-encrypt entirely inside enclave
- **Ephemeral keys**: fresh X25519 per agent instance; no long-term key stored
- **Sandboxed Docker**: `--network none --cap-drop ALL`

## What Makes Tenxo Different (vs Vast.ai / RunPod / Lambda)

| Feature | Tenxo | Vast.ai | RunPod | Lambda |
|---------|-------|---------|--------|--------|
| **E2E Encryption** | Zero-knowledge ECDH + AES-256-GCM | ❌ Platform has access to data | ❌ Platform has access | ❌ Platform has access |
| **Zero-Knowledge Matchmaker** | Routes XOR'd keys, never plaintext | ❌ | ❌ | ❌ |
| **TEE Attestation** | Agent proves integrity via SEV-SNP / TDX quote | ❌ | ❌ | ❌ |
| **Payload Padding** | Tier-padded (1/5/10 GB) for plausible deniability | ❌ | ❌ | ❌ |
| **Forward Secrecy** | Ephemeral ECDH keys per session | ❌ | ❌ | ❌ |
| **No Single Trust Party** | Even we can't decrypt your data | You trust Vast.ai | You trust RunPod | You trust Lambda |
| **UPI Payments** | Credit card + UPI (India) | Card/PayPal/Crypto | Card/PayPal | Card/Invoice |
| **Per-Second Billing** | Yes | Hourly | Per-second | Monthly |
| **CLI + Web** | `pip install tenxo` + dashboard | Web + SSH | Web + CLI | Web + CLI |

**TL;DR: Tenxo is the first GPU cloud where the platform operator cannot access your data — ever.**

## Deployment

### Code pushed to GitHub
```
Repo: https://github.com/Tanya25-05/tenxo  (private)
Branch: main
```

### To deploy on Render (Backend) + Vercel (Frontend):

#### 1. Render — Matchmaker + Redis

1. Go to https://dashboard.render.com
2. Create a **New Web Service** → connect your GitHub repo
3. Set:
   - **Root Directory**: `backend/`
   - **Build Command**: `go build -o matchmaker .`
   - **Start Command**: `./matchmaker`
4. Add env vars (copy from `.env.example`):
   - `API_ADDR=:8080`
   - `NATS_URL=nats://nats:4222`
   - `REDIS_ADDR=redis://your-redis-url:6379`
   - `STRIPE_SECRET_KEY=sk_test_...`
   - `STRIPE_WEBHOOK_SECRET=whsec_...`
   - `SUPABASE_JWKS_URL=https://your-project.supabase.co/.well-known/jwks.json`
5. Create a **Redis** instance on Render — copy the connection string
6. Deploy

#### 2. Render — Frontend (Static Site)

1. Go to https://dashboard.render.com → **New +** → **Static Site**
2. Connect your GitHub repo → root `frontend/`
3. Build command: `npm install && npm run build`
4. Publish directory: `out`
5. Add env vars:
   - `NEXT_PUBLIC_API_URL=https://tenxo-api.onrender.com`
   - `NEXT_PUBLIC_WS_URL=wss://tenxo-api.onrender.com`
   - `NEXT_PUBLIC_SUPABASE_URL=...`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
   - `NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...`
6. Create — it stays awake 24/7 for $0

#### 3. Razorpay — Payment Webhook

1. Go to https://dashboard.razorpay.com → **Settings → Webhooks**
2. Add endpoint: `https://tenxo-api.onrender.com/billing/webhook`
3. Events: `payment.captured`, `payment.failed`
4. Generate a secret → set as `RAZORPAY_WEBHOOK_SECRET` on Render

#### 4. Supabase — Auth

1. Create project at https://supabase.com
2. Enable email auth (or Google/GitHub OAuth)
3. Copy project URL + anon key → set on Render Static Site env
4. Get JWKS URL → set on Render Web Service
