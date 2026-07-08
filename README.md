# Tenxo — Zero-Knowledge Decentralized GPU Grid

A distributed GPU compute marketplace with end-to-end encryption. The matchmaker routes **only public keys and salts** — it never sees the AES payload key, the ECDH shared secret, or the plaintext workload. The payload key is additionally **XOR-blinded** with the ECDH shared secret so that intercepting the salt alone is insufficient to derive the key.


### Security properties

| Property | Status |
|---|---|
| **ECDH key exchange** | ✅ Working — X25519, matchmaker never sees shared secret |
| **AES-256-GCM encryption** | ✅ Working — per-job key derived via HKDF-SHA256 |
| **XOR blinding** | ✅ Working — `final_key = HKDF(shared_secret, salt) XOR shared_secret` |
| **LUKS2 at-rest encryption** | ✅ Working — sparse container, ephemeral passphrase, shredded on teardown |
| **Payload padding** | ✅ Working — standard tier sizes for plausible deniability |
| **Integrity receipts** | ✅ Working — SHA-256 of input and output, encrypted and stored separately |
| **Kata Containers support** | ✅ Working — VM-level isolation via `AGENT_RUNTIME=kata` env var; NVIDIA GPU PCI passthrough |
| **TEE attestation (AMD SEV-SNP)** | ⚠️ Dev mode — quote structure is correct but hardware TEE is not enabled; `report_data[0:32]` binds the agent's raw X25519 pubkey |
| **Zero-knowledge matchmaker** | ⚠️ Partially — matchmaker routes keys and salts blindly, but the protocol does not yet use a formal ZK proof system (ZK-SNARKs are aspirational) |

## Components

| Component | Language | Location | Role |
|---|---|---|---|
| **Matchmaker** | Go 1.24 | `backend/` | HTTP API, signaling, billing, job queue (NATS) |
| **Edge Agent** | Rust | `edge_agent/` | GPU-side execution, ECDH key exchange, LUKS container |
| **CLI/SDK** | Python | `tenxo/` | Key generation, encryption, job submission, result verification |
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

Sign in at https://tenxo.xyz → go to **Developer Console**

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

### Container Runtime Selection

The edge agent supports two container runtimes, selected via the `AGENT_RUNTIME` env var:

| Runtime | Isolation | GPU | Setup Requirement |
|---|---|---|---|
| `docker` (default) | Namespace-level (host kernel shared) | `--gpus all` | Docker + nvidia-container-toolkit |
| `kata` | VM-level (each container gets its own kernel via lightweight VM) | PCI device passthrough | Kata Containers runtime + Docker configured with `io.containerd.kata.v2` |

Kata Containers (https://katacontainers.io) is an open-source runtime that wraps each container in a hardware-virtualized VM using QEMU, Cloud Hypervisor, or Firecracker. To use it:

1. Install Kata Containers: `sudo apt-get install kata-containers` (Ubuntu) or `sudo dnf install kata-containers` (Fedora)
2. Register the runtime in `/etc/docker/daemon.json`:
   ```json
   { "runtimes": { "kata": { "path": "/usr/bin/kata-runtime" } } }
   ```
3. Restart Docker: `sudo systemctl restart docker`
4. Run the agent with `AGENT_RUNTIME=kata`

The agent will auto-detect NVIDIA GPUs via `nvidia-smi` and pass them as PCI devices. When neither runtime is available or GPU detection fails, the job is rejected with a clear error.

### How the Agent Protects Data

The edge agent runs an ephemeral per-job pipeline:

1. **LUKS2 container** — a 256 MB sparse file is formatted with LUKS2+Argon2i using a random per-job passphrase. All plaintext lives inside this encrypted container and is never written to the raw provider disk.
2. **Docker isolation** — the user's code runs in Docker with `--network none`, `--cap-drop ALL`, `--security-opt no-new-privileges:true`, GPU passthrough, and strict memory/CPU limits.
3. **Integrity receipts** — SHA-256 hashes of input and output are computed before the LUKS container is opened (for input) and before re-encryption (for output). The receipt is encrypted and uploaded as a separate blob; the client verifies output integrity after decryption.
4. **Shred on teardown** — after the job, the LUKS container is unmounted, closed, and the container file is overwritten with `shred -n 1` before deletion.

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

## Comparison

| Feature | Tenxo | Vast.ai | RunPod | Lambda |
|---|---|---|---|---|
| **E2E Encryption** | HKDF + XOR-blinded AES-256-GCM | ❌ | ❌ | ❌ |
| **LUKS2 At-Rest Encryption** | Per-job LUKS2 container, shredded after use | ❌ | ❌ | ❌ |
| **XOR-Blinded Key Exchange** | `final_key = HKDF(secret, salt) XOR secret` | ❌ | ❌ | ❌ |
| **Integrity Receipts** | SHA-256 input/output hashes, encrypted separately | ❌ | ❌ | ❌ |
| **Payload Padding** | Tier-padded for plausible deniability | ❌ | ❌ | ❌ |
| **Forward Secrecy** | Ephemeral ECDH keys per session | ❌ | ❌ | ❌ |
| **TEE Attestation** | Dev-mode AMD SEV-SNP quoting (hardware TEE aspirational) | ❌ | ❌ | ❌ |
| **Zero-Knowledge Matchmaker** | Keys + salts routed blindly (ZK-SNARKs aspirational) | ❌ | ❌ | ❌ |
| **No Single Trust Party** | Even we can't decrypt your data* | Trust Vast | Trust RunPod | Trust Lambda |
| **Per-Second Billing** | Yes | Hourly | Per-second | Monthly |
| **CLI + Web** | `pip install tenxo` + dashboard | Web + SSH | Web + CLI | Web + CLI |

*\*Assuming the ECDH shared secret is never leaked and the TEE is not bypassed.*

**TL;DR: Tenxo is a GPU cloud where the platform operator cannot access your workload data — the matchmaker never sees the ECDH shared secret or AES key, and the agent stores plaintext only inside an ephemeral LUKS2 container inside the TEE boundary.**

---

## Project Structure

```
GPU_grid/
├── backend/          # Go matchmaker (HTTP API, signaling, billing)
├── edge_agent/       # Rust GPU agent (decrypt, execute, encrypt, LUKS)
├── tenxo/            # Python SDK + CLI for developers
├── frontend/         # Next.js web app
├── deploy/           # Production deployment configs
├── install.sh        # One-command provider installer
└── docker-compose.yml # Local dev infrastructure
```
