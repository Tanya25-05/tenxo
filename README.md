# Tenxo — Zero-Knowledge Decentralized GPU Grid

A distributed GPU compute marketplace with E2EE execution. The matchmaker routes **only public keys** — it never sees the AES payload key, the ECDH shared secret, or the plaintext workload.

```
Client                        Matchmaker                Agent
  │                              │                       │
  │  1. Register Session         │                       │
  │◄─────────────────────────────│                       │
  │                              │ 2. Agent connects     │
  │                              │◄──────────────────────│
  │  3. Agent's TEE Quote        │                       │
  │◄─────────────────────────────│                       │
  │  4. Verify Quote, send       │                       │
  │     ClientPubKey             │                       │
  │──────────────────────────────►  5. Forward PubKey    │
  │                              │──────────────────────►│
  │                              │  6. Compute ECDH,     │
  │                              │     derive AES key    │
  │  7. Submit job (salt only)   │                       │
  │──────────────────────────────►  8. Forward job       │
  │                              │──────────────────────►│
  │                              │  9. Derive AES key    │
  │                              │     (HKDF + salt),    │
  │                              │     decrypt, execute, │
  │                              │     re-encrypt result │
  │ 10. Download result          │                       │
  │◄─────────────────────────────│                       │
  │ 11. Decrypt locally          │                       │
```

### Key properties
- **Matchmaker is zero-knowledge**: routes public keys only
- **ECDH shared secret** derived client-side and agent-side — never transmitted
- **AES payload key** = HKDF-SHA256(ECDH_shared_secret, per-job_salt) — fresh per job
- **Payloads padded** to 1/5/10 GB tiers for plausible deniability
- **TEE attestation**: agent proves it runs inside AMD SEV-SNP / Intel TDX

## Components

| Component | Language | Location | Role |
|---|---|---|---|
| **Matchmaker** | Go 1.24 | `backend/` | HTTP API, signaling, billing, job queue (NATS) |
| **Edge Agent** | Rust | `edge_agent/` | GPU-side execution, ECDH key exchange |
| **CLI/SDK** | Python | `tenxo/` | Key generation, encryption, job submission |
| **Frontend** | TypeScript | `frontend/` | Next.js web app (console + marketing) |

---

## For Developers (Renters)

Submit GPU jobs from your CLI or the web dashboard.

### Prerequisites

```bash
pip install tenxo
```

### Quick Start

```bash
# Set your API key (auto-generated after logging in)
tenxo config set --key txn_your_api_key_here

# List available GPUs
tenxo nodes

# Submit a job
tenxo run model.tar.gz --gpu a5000

# Check status
tenxo status job-a1b2c3d4

# Download results
tenxo download job-a1b2c3d4
```

### Web Dashboard

Sign in at https://tenxo.onrender.com → go to **Developer Console**

- API keys auto-generate on first visit
- View job history, billing, usage
- Monitor active jobs

---

## For Providers (GPU Owners)

Earn by connecting your GPU to the Tenxo grid.

### Quick Start

```bash
# One-command setup (Docker + NVIDIA required)
curl -fsSL https://tenxo-api.onrender.com/install.sh | bash -s -- --owner YOUR_USER_ID
```

Get your `USER_ID` from the Tenxo dashboard → Provider Console.

### Manual Setup

```bash
git clone https://github.com/Tanya25-05/tenxo.git
cd tenxo/edge_agent
cargo build --release

MATCHMAKER_URL=https://tenxo-api.onrender.com \
OWNER=<your_user_id> \
./target/release/edge_agent
```

### What You Get

- **93% payout share** of compute revenue
- **Weekly payouts** via Stripe Connect (minimum $50)
- **Per-second billing** — you earn for actual compute time
- **Fleet dashboard** — see all your nodes, status, and earnings

---

## Production Services

| Service | URL |
|---|---|
| Matchmaker API | `https://tenxo-api.onrender.com` |
| Frontend | `https://tenxo.onrender.com` |
| Supabase Auth | Project dashboard |

### Provider Environment Variables

```bash
# Set these on the machine running the edge agent
MATCHMAKER_URL=https://tenxo-api.onrender.com
OWNER=<your_supabase_user_id>
```

---

## Local Development

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Start matchmaker (port :8080)
cd backend && go run main.go

# 3. Edge agent (local)
cd edge_agent && MATCHMAKER_URL=http://localhost:8080 \
    OWNER=local-dev-user \
    cargo run --release

# 4. Submit a job
cd tenxo && python -m tenxo run ./my_work \
    --api-url http://localhost:8080 \
    --api-key dev-local-abc123
```

Register a test API key:

```bash
HASH=$(echo -n "dev-local-abc123" | sha256sum | cut -d' ' -f1)
docker compose exec postgres psql -U postgres -d tenxo -c \
  "INSERT INTO api_keys (key_hash, user_id) VALUES ('$HASH', 'local-dev-user') ON CONFLICT DO NOTHING;"
```

---

## What Makes Tenxo Different

| Feature | Tenxo | Vast.ai | RunPod | Lambda |
|---|---|---|---|---|
| **E2E Encryption** | Zero-knowledge ECDH + AES-256-GCM | ❌ | ❌ | ❌ |
| **Zero-Knowledge Matchmaker** | Routes XOR'd keys, never plaintext | ❌ | ❌ | ❌ |
| **TEE Attestation** | Agent proves integrity via SEV-SNP quote | ❌ | ❌ | ❌ |
| **Payload Padding** | Tier-padded for plausible deniability | ❌ | ❌ | ❌ |
| **Forward Secrecy** | Ephemeral ECDH keys per session | ❌ | ❌ | ❌ |
| **No Single Trust Party** | Even we can't decrypt your data | Trust Vast | Trust RunPod | Trust Lambda |
| **Per-Second Billing** | Yes | Hourly | Per-second | Monthly |
| **CLI + Web** | `pip install tenxo` + dashboard | Web + SSH | Web + CLI | Web + CLI |

**TL;DR: Tenxo is the first GPU cloud where the platform operator cannot access your data.**

---

## Project Structure

```
GPU_grid/
├── backend/          # Go matchmaker (HTTP API, signaling, billing)
├── edge_agent/       # Rust GPU agent (decrypt, execute, encrypt)
├── tenxo/            # Python SDK + CLI for developers
├── frontend/         # Next.js web app
├── deploy/           # Production deployment configs
├── install.sh        # One-command provider installer
└── docker-compose.yml # Local dev infrastructure
```
