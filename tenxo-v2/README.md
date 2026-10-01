# Tenxo v2 — AI-Native Decentralized GPU Cloud Platform

## Quick Start

```bash
# Start all services locally
cd deploy/docker
docker compose up -d

# Or with Kubernetes
cd deploy/kubernetes
kubectl apply -f .
```

## Architecture

See [ARCHITECTURE_v2.md](../ARCHITECTURE_v2.md)

## Services

| Service | Port | Description |
|---------|------|-------------|
| API Gateway | 8000 | Unified entry point, auth, rate limiting |
| Chat Service | 8001 | Natural language interface, WebSocket |
| AI Planner | 8002 | LangGraph workflow, LLM planning |
| Compute Planner | 8003 | Cost/runtime/GPU prediction |
| Scheduler | 8004 | Intelligent GPU scheduling (Ray) |
| Deployment Service | 8005 | Artifact generation, TEE attestation |
| Monitoring Service | 8006 | Prometheus, OpenTelemetry, metrics |
| Billing Service | 8007 | Usage tracking, invoicing |
| Edge Agent | - | Provider-side workload execution |

## Tech Stack

- **API:** FastAPI + gRPC + NATS JetStream
- **AI:** LangGraph + OpenAI/Anthropic
- **Scheduler:** Ray + custom scoring
- **Frontend:** Next.js 15 + React 19 + Tailwind + shadcn/ui
- **Database:** PostgreSQL 16 + pgvector + TimescaleDB
- **Queue:** NATS JetStream
- **Storage:** MinIO (S3-compatible)
- **Monitoring:** Prometheus + Grafana + OpenTelemetry + Jaeger
- **Containers:** Docker + Kata Containers
- **Orchestration:** Kubernetes (K3s for edge)

## Environment

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
# Edit .env with your keys
```

## Development

```bash
# Install dependencies
make install

# Run tests
make test

# Lint
make lint

# Build all Docker images
make build
```