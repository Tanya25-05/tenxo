# Tenxo Deployment and Operations

## Local Development Setup

Prerequisites:

- Go 1.25+
- Node.js 20+
- Rust stable
- Python 3.10+
- Docker Compose
- Supabase project for frontend auth, or API-key-only backend testing

Start dependencies:

```bash
docker compose up -d postgres nats
```

Backend:

```bash
cd backend
cp .env.example .env
DATABASE_URL=postgres://postgres:postgres@localhost:5432/tenxo?sslmode=disable \
NATS_URL=nats://localhost:4222 \
ALLOWED_ORIGINS=http://localhost:3000 \
PUBLIC_API_URL=http://localhost:8080 \
go run .
```

Frontend:

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8080 \
NEXT_PUBLIC_WS_URL=ws://localhost:8080 \
npm run dev
```

Edge agent:

```bash
cd edge_agent
cargo run -- --api-url http://localhost:8080 --token "$TENXO_API_KEY"
```

Python CLI:

```bash
cd tenxo
pip install -e .
tenxo --help
```

## Environment Configuration

Backend:

- `DATABASE_URL`: PostgreSQL connection string.
- `NATS_URL`: NATS server URL.
- `NATS_STREAM`: JetStream stream name, defaults to `JOB_STREAM`.
- `API_ADDR`: listen address, defaults to `:8080`.
- `PUBLIC_API_URL`: public API base for local storage URLs.
- `ALLOWED_ORIGINS`: comma-separated frontend origins. Do not use `*` in production.
- `SUPABASE_JWKS_URL`: Supabase JWKS URL for JWT validation.
- `UPLOADS_DIR`: local encrypted object directory for development.
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ENDPOINT`: production object storage.
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`: billing.

Frontend:

- `NEXT_PUBLIC_API_URL`: HTTPS API URL.
- `NEXT_PUBLIC_WS_URL`: WSS API URL.
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key.
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`: Razorpay checkout key.

## Production Deployment

1. Build immutable images for backend and frontend.
2. Run PostgreSQL with daily backups, point-in-time recovery, and restricted network access.
3. Run NATS JetStream with persistent volumes, auth, and private network access.
4. Configure R2 or S3-compatible object storage. Keep payload buckets private.
5. Set `SUPABASE_JWKS_URL`, `ALLOWED_ORIGINS`, and all payment secrets.
6. Expose only HTTPS frontend, HTTPS API, WSS API, and Razorpay webhook routes publicly.
7. Run schema migration on backend startup or in a controlled release job.
8. Configure Razorpay webhook to `/billing/webhook`.
9. Roll out edge agents with least-privilege `txn_` API keys.

## Infrastructure Requirements

- Backend: horizontally scalable stateless API instances; persistent state in PostgreSQL/NATS/R2.
- PostgreSQL: production-grade managed instance, connection pooling, backups, and storage alerts.
- NATS: JetStream disk sized for queued workloads and retry windows.
- Object storage: encrypted at rest, private bucket, lifecycle cleanup for old job blobs.
- GPU nodes: NVIDIA drivers, container runtime, outbound HTTPS/NATS, host hardening.

## Security Best Practices

- Pin `ALLOWED_ORIGINS`; never deploy permissive CORS.
- Keep all API keys, Supabase JWTs, Razorpay keys, database URLs, and R2 keys out of logs.
- Rotate `txn_` API keys and Razorpay/Supabase credentials on incident response.
- Use TLS for every public endpoint and WSS for browser sockets.
- Do not expose PostgreSQL or NATS publicly.
- Enforce request body size limits for uploads, webhooks, and JSON APIs.
- Prefer R2 presigned URLs over local API file writes in production.
- Keep webhook HMAC verification enabled and fail closed when secrets are missing.
- Run dependency scanning for Go, npm, Rust, and Python lockfiles.
- Use separate credentials for frontend anon auth, backend service access, object storage, and worker agents.

## Scaling Strategy

- Scale frontend statically or with platform autoscaling.
- Scale backend horizontally; keep WebSocket affinity if the platform requires it.
- Add NATS queue consumers by increasing edge worker count.
- Add explicit job reservation records before introducing multi-GPU scheduling or SLA guarantees.
- Partition job and usage tables by time when volume grows.
- Use object storage lifecycle policies for completed or failed workloads.
- Add rate limits to `/jobs`, `/presign`, `/api/keys`, `/billing/*`, and signaling routes.

## Monitoring and Logging

Track:

- API latency, error rate, request volume, and auth failures.
- `/jobs` queue depth, age of oldest queued job, completion rate, failure rate.
- Node heartbeat count, stale-node rate, GPU SKU availability.
- NATS JetStream lag, redeliveries, and storage usage.
- PostgreSQL CPU, storage, slow queries, locks, and connection saturation.
- Object storage upload/download failures and byte volume.
- Razorpay webhook failures, payment failures, and charge latency.
- WebSocket connection count and reconnect rate.

Operational logs should include request IDs, user IDs, job IDs, node IDs, status transitions, and payment IDs. They must not include raw JWTs, raw `txn_` keys, encryption keys, card data, or full presigned URLs.

## User Flows

### GPU Providers

1. Create an account and sign in.
2. Open Hardware.
3. Create or copy a scoped API key from API & Billing.
4. Run the worker install command with `TENXO_TOKEN`.
5. Agent registers the node and sends heartbeats.
6. Provider verifies node status, GPU model, VRAM, TEE state, and heartbeat TTL.
7. When jobs run, earnings and payout tracking should be populated from the provider settlement ledger.

### Node Setup

1. Install NVIDIA drivers and verify `nvidia-smi`.
2. Install the Tenxo edge agent.
3. Configure `TENXO_API_URL`, `TENXO_NATS_URL`, and `TENXO_TOKEN`.
4. Start the agent as a system service.
5. Confirm `/my-nodes` shows the node as idle.
6. Monitor logs for heartbeat, job claim, result upload, and failure events.

### GPU Sharing

1. Provider keeps the agent online.
2. Agent advertises available GPU SKU, VRAM, and attestation state.
3. Matchmaker lists fresh nodes to consumers.
4. Worker claims eligible jobs from NATS.
5. Worker uploads encrypted output and reports completion.
6. Usage and provider settlement records are generated from lifecycle events.

### Earnings and Payout Tracking

1. Provider opens Hardware.
2. Dashboard shows active nodes and current fleet capacity.
3. Settlement service should aggregate completed usage by node and provider.
4. Payout records should show gross usage, platform fee, net payout, status, and payout date.

### GPU Consumers

1. Create an account and sign in.
2. Add a payment method in Billing.
3. Open Compute or Marketplace.
4. Select GPU SKU based on availability, VRAM, TEE status, and price.
5. Upload encrypted workload using web or CLI.
6. Submit job and watch queued, running, result uploaded, completed, or failed lifecycle states.
7. Download encrypted result.
8. Review billing usage, payment methods, and transaction history.

### Billing and Usage Tracking

1. Job lifecycle starts usage when work begins.
2. Usage stops on completion, failure, or stale-job reaping.
3. Usage totals update GPU seconds.
4. Auto-charge runs when unpaid usage crosses threshold.
5. Razorpay webhook confirms captured payments.
6. Billing page displays unpaid balance, GPU hours, saved payment methods, and transaction history.

