# Tenxo v2 Architecture — AI-Native Decentralized GPU Cloud Platform

## Executive Summary

Tenxo v2 is a complete architectural redesign transforming the existing zero-knowledge GPU marketplace into an **AI-native intelligent compute orchestration platform**. Users describe workloads in natural language; the system autonomously plans, provisions, deploys, monitors, scales, and recovers — hiding all infrastructure complexity.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            TENAXO v2 PLATFORM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────────────────────────────────────────┐   │
│  │   NEXT.JS    │    │              API GATEWAY (FastAPI)                │   │
│  │   GUI        │◄───│  /chat  /deploy  /jobs  /nodes  /marketplace      │   │
│  │              │    │  /planner  /scheduler  /monitoring  /billing      │   │
│  └──────────────┘    └──────────────────────────────────────────────────┘   │
│         │                        │                    │                     │
│         │ WebSocket              │ gRPC/REST        │ gRPC/REST             │
│         ▼                        ▼                    ▼                     │
│  ┌──────────────┐    ┌──────────────────┐  ┌──────────────────┐           │
│  │   CHAT       │    │   AI PLANNER     │  │  INTELLIGENT     │           │
│  │   SERVICE    │    │   (LangGraph)    │  │  SCHEDULER       │           │
│  │              │    │                  │  │  (Ray + Custom)  │           │
│  └──────────────┘    └────────┬─────────┘  └────────┬─────────┘           │
│                               │                     │                     │
│         ┌─────────────────────┼─────────────────────┼─────────────────┐   │
│         ▼                     ▼                     ▼                 ▼   │
│  ┌──────────────┐    ┌──────────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │  COMPUTE     │    │   DEPLOYMENT     │  │  MONITORING  │  │ BILLING  │ │
│  │  PLANNER     │    │   SERVICE        │  │  SERVICE     │  │ SERVICE  │ │
│  └──────────────┘    └────────┬─────────┘  └──────────────┘  └──────────┘ │
│                               │                                        │   │
│         ┌─────────────────────┼────────────────────────────────────────┘   │
│         ▼                     ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │                    MESSAGE BUS (NATS JetStream)                   │      │
│  │  jobs.plan  jobs.schedule  jobs.deploy  jobs.monitor  jobs.result │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                               │                                            │
│         ┌─────────────────────┼────────────────────────────────────────┐   │
│         ▼                     ▼                                        ▼   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────┐   │
│  │   POSTGRESQL │    │    QDRANT    │    │    REDIS     │    │ MINIO  │   │
│  │  (Primary DB)│    │ (Vector DB)  │    │ (Cache/Queue)│    │(Storage)│   │
│  └──────────────┘    └──────────────┘    └──────────────┘    └────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    EDGE AGENTS (Rust) — Provider Nodes               │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐  ┌─────────┐ ┌─────────┐      │  │
│  │  │ GPU 1   │ │ GPU 2   │ │ GPU N   │  │  TEE    │ │ LUKS    │      │  │
│  │  │ Agent   │ │ Agent   │ │ Agent   │  │ Attest. │ │ Encrypt │      │  │
│  │  └─────────┘ └─────────┘ └─────────┘  └─────────┘ └─────────┘      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Services

### 1. API Gateway (FastAPI)
**Port:** 8000 | **Language:** Python 3.11+

Central entry point. Routes requests to appropriate services via gRPC. Handles:
- Authentication (Keycloak JWT validation)
- Rate limiting
- Request/response validation (Pydantic)
- WebSocket upgrade for real-time updates
- OpenAPI documentation

### 2. Chat Service
**Port:** 8001 | **Language:** Python 3.11+

Natural language interface. Handles:
- WebSocket connections for streaming responses
- Session management and context
- Tool calling to AI Planner
- Streaming execution updates to GUI

### 3. AI Planner (LangGraph)
**Port:** 8002 | **Language:** Python 3.11+

Converts natural language → structured execution plan. Uses LangGraph for multi-step reasoning:
- Intent classification (train/inference/fine-tune/deploy/eval)
- Model/framework detection
- Resource estimation (GPU count, VRAM, storage, runtime)
- Deployment strategy selection (single/multi-node, distributed)
- Confidence scoring
- Alternative plan generation

**Output Schema:**
```json
{
  "framework": "PyTorch|TensorFlow|JAX|vLLM|Ollama",
  "model": "Llama-3.1-8B|Qwen3-8B|...|custom",
  "task": "train|finetune|inference|eval|deploy",
  "dataset": "huggingface://...|s3://...|local://...",
  "gpu_count": 1,
  "recommended_gpu": "RTX4090|H100|A100|...",
  "estimated_runtime": "2h30m",
  "estimated_cost": 14.10,
  "deployment": "Single|Distributed|DataParallel|FSDP|DeepSpeed",
  "confidence": 96,
  "alternatives": [...],
  "requirements": {
    "vram_gb": 24,
    "storage_gb": 50,
    "network_gbps": 10
  }
}
```

### 4. Compute Planner
**Port:** 8003 | **Language:** Python 3.11+

Pre-deployment analysis engine. Computes:
- Cost estimates across GPU types/providers
- Runtime predictions using historical benchmarks
- VRAM requirements (model + optimizer + gradients + activation)
- Storage requirements (dataset + checkpoints + outputs)
- Throughput predictions (tokens/sec, samples/sec)
- Failure risk scoring
- Alternative deployment plans (spot vs on-demand, single vs multi-GPU)

### 5. Intelligent Scheduler (Ray + Custom)
**Port:** 8004 | **Language:** Python 3.11+

Ray-based distributed scheduler with custom scoring algorithm. Factors:
- **GPU Availability** — Real-time capacity from node heartbeats
- **Benchmark History** — TFLOPS, memory bandwidth, actual vs theoretical
- **Network Topology** — Latency, bandwidth between nodes (for distributed)
- **Node Reliability** — Uptime, failure rate, MTBF
- **Energy Efficiency** — Perf/Watt from historical runs
- **Price-Performance** — $/TFLOP-hour, $/token for inference
- **TEE Availability** — Attestation status, TCB version
- **Affinity/Anti-affinity** — Data locality, fault domains

**Scoring Formula:**
```
Score = w1*PerfScore + w2*ReliabilityScore + w3*CostScore + w4*NetworkScore + w5*TEEScore
```

### 6. Deployment Service
**Port:** 8005 | **Language:** Python 3.11+

Generates and manages deployment artifacts:
- Dockerfile generation (base image, dependencies, entrypoint)
- Kubernetes manifests (Job, Deployment, Service, PVC, Secret)
- Docker Compose for single-node
- TEE attestation integration (AMD SEV-SNP, Intel TDX, NVIDIA CCA)
- Environment variable injection
- Volume mounts (datasets, models, outputs)
- Resource limits/requests
- Init containers for data prep
- Sidecars for monitoring/logging

### 7. Monitoring Service
**Port:** 8006 | **Language:** Python 3.11+

Observability stack:
- **Prometheus** metrics collection (custom + node exporter)
- **Grafana** dashboards (pre-built for GPU, jobs, cluster)
- **OpenTelemetry** distributed tracing
- **Alertmanager** + PagerDuty/Slack/Email
- Real-time WebSocket metrics to GUI
- Custom metrics: GPU utilization, VRAM, temperature, power, throughput

### 8. Billing Service
**Port:** 8007 | **Language:** Python 3.11+

- Per-second GPU billing
- Provider payouts (Stripe Connect)
- Cost estimation integration
- Budget enforcement (hard/soft limits)
- Invoice generation
- Usage analytics

---

## Data Layer

### PostgreSQL (Primary)
**Extensions:** `pgvector`, `timescaledb`, `uuid-ossp`, `pg_cron`

**Tables:**
- `users`, `organizations`, `api_keys`
- `nodes` — GPU inventory, benchmarks, TEE status, location
- `jobs` — execution plans, status, resources, costs
- `job_events` — timeline (TimescaleDB hypertable)
- `benchmarks` — historical GPU performance data
- `deployments` — generated artifacts, K8s resources
- `billing_accounts`, `transactions`, `provider_earnings`
- `datasets`, `models` — registry metadata
- `chat_sessions`, `chat_messages` — conversation history

### Qdrant (Vector DB)
- Embeddings for model/dataset search
- Semantic search for "similar workloads"
- RAG for AI Planner context

### Redis (Cache/Queue)
- Session cache
- Rate limiting
- Job queue (backup to NATS)
- Real-time pub/sub for metrics

### MinIO (Object Storage)
- Dataset storage
- Model checkpoints
- Job outputs/artifacts
- Deployment packages

### NATS JetStream (Message Bus)
- Inter-service communication
- Job lifecycle events
- Agent ↔ Platform signaling
- Durable, ordered, replayable

---

## Edge Agent (Rust) — Enhanced

**Responsibilities:**
1. **Identity** — ed25519 persistent keys, TOFU registration
2. **Benchmarking** — Automated GPU benchmarks (TFLOPS, bandwidth, latency)
3. **Heartbeats** — Capacity, utilization, health, TEE status
4. **TEE Attestation** — Real SEV-SNP/TDX/CCA quotes with remote verification
5. **Secure Execution** — LUKS2 encrypted containers, memory encryption
6. **Workload Execution** — Docker/Kata, GPU passthrough, resource limits
7. **Checkpointing** — Periodic state snapshots to MinIO
8. **Migration Support** — Live migration coordination
9. **Metrics Export** — Prometheus node exporter + custom GPU metrics

---

## GUI (Next.js 15+ App Router)

### Pages / Modules

| Module | Route | Description |
|--------|-------|-------------|
| **Chat Deploy** | `/chat` | Natural language → deployment |
| **Deploy Model** | `/deploy` | Guided model deployment wizard |
| **Running Jobs** | `/jobs` | Live job list with logs, metrics, actions |
| **GPU Marketplace** | `/marketplace` | Real-time GPU availability, pricing, benchmarks |
| **Compute Planner** | `/planner` | Pre-deployment cost/runtime analysis |
| **Cost Estimator** | `/estimator` | Standalone cost calculator |
| **Dataset Manager** | `/datasets` | Upload, version, share datasets |
| **Model Registry** | `/models` | Private/public model registry |
| **Logs** | `/jobs/[id]/logs` | Streaming logs with search |
| **Live Metrics** | `/jobs/[id]/metrics` | Real-time GPU/CPU/Memory/Network charts |
| **Billing** | `/billing` | Usage, invoices, budgets, payment methods |
| **Node Health** | `/nodes` | Provider node fleet health |
| **Workload Timeline** | `/timeline` | Historical execution visualization |

### Tech Stack
- Next.js 15 (App Router, Server Components)
- React 19, TypeScript 5.5+
- Tailwind CSS 3.4 + shadcn/ui
- TanStack Query (server state)
- Zustand (client state)
- xterm.js (browser terminal)
- Apache ECharts (metrics charts)
- Socket.io client (real-time)
- NextAuth.js (Keycloak OIDC)

---

## Deployment

### Local Development
```yaml
# docker-compose.yml
services:
  postgres:      # + timescaledb, pgvector
  qdrant:
  redis:
  minio:
  nats:          # JetStream
  keycloak:
  api-gateway:
  chat-service:
  ai-planner:
  compute-planner:
  scheduler:
  deployment-service:
  monitoring-service:
  billing-service:
  frontend:
  prometheus:
  grafana:
  jaeger:        # OpenTelemetry
```

### Production (Kubernetes)
- **Namespace:** `tenxo`
- **Helm charts** for each service
- **ArgoCD** for GitOps
- **Cert-manager** + Let's Encrypt
- **External-DNS** for Route53/Cloudflare
- **KEDA** for event-driven scaling
- **GPU Operator** for NVIDIA device plugin
- **Node Feature Discovery** for GPU labels

---

## Security Model

1. **Zero-Knowledge Execution** — Matchmaker never sees workload plaintext
2. **TEE Attestation** — Remote verification before deployment
3. **ECDH Key Exchange** — Per-job ephemeral keys, XOR-blinded
4. **LUKS2 Encryption** — At-rest encryption on provider nodes
5. **Network Isolation** — `--network none`, egress allowlists
6. **Capability Dropping** — `--cap-drop ALL --security-opt no-new-privileges`
7. **Audit Logging** — Immutable job receipts with integrity hashes
8. **RBAC** — Organization/project/resource-level permissions

---

## Migration Strategy (v1 → v2)

| Phase | Scope | Timeline |
|-------|-------|----------|
| **Phase 1** | AI Planner + Compute Planner + Intelligent Scheduler + Chat GUI | 4-6 weeks |
| **Phase 2** | Deployment Service + Monitoring + Enhanced Edge Agent (TEE) | 4-6 weeks |
| **Phase 3** | Full GUI (all modules) + Billing + Model/Dataset Registry | 4-6 weeks |
| **Phase 4** | Kubernetes manifests + CI/CD + Production hardening | 3-4 weeks |
| **Phase 5** | Migration tooling, v1 API compatibility, deprecation | 2-3 weeks |

---

## API Contracts

### Chat Service
```
WS /api/v1/chat/stream
  → { "message": "Fine-tune Llama 3.1 8B on my dataset with $50 budget" }
  ← { "type": "plan", "plan": {...} }
  ← { "type": "confirm", "options": [...] }
  ← { "type": "executing", "job_id": "..." }
  ← { "type": "progress", "metrics": {...} }
  ← { "type": "complete", "result_url": "..." }
```

### AI Planner
```
POST /api/v1/planner/plan
  { "prompt": "...", "context": {...} }
  → { "plan": {...}, "alternatives": [...] }

POST /api/v1/planner/refine
  { "plan_id": "...", "feedback": "..." }
  → { "plan": {...} }
```

### Compute Planner
```
POST /api/v1/planner/estimate
  { "plan": {...} }
  → { "estimates": [...], "recommended": {...} }
```

### Scheduler
```
POST /api/v1/scheduler/schedule
  { "plan": {...}, "constraints": {...} }
  → { "deployment": {...}, "nodes": [...] }
```

### Deployment
```
POST /api/v1/deployment/generate
  { "plan": {...}, "target_nodes": [...] }
  → { "artifacts": {...}, "k8s_manifests": [...] }
```

### Jobs
```
GET    /api/v1/jobs
POST   /api/v1/jobs
GET    /api/v1/jobs/{id}
GET    /api/v1/jobs/{id}/logs
GET    /api/v1/jobs/{id}/metrics
WS     /api/v1/jobs/{id}/stream
POST   /api/v1/jobs/{id}/cancel
POST   /api/v1/jobs/{id}/checkpoint
POST   /api/v1/jobs/{id}/migrate
```

### Nodes/Marketplace
```
GET /api/v1/nodes
GET /api/v1/nodes/{id}
GET /api/v1/nodes/{id}/benchmarks
GET /api/v1/marketplace/availability
```

---

## Technology Decisions

| Layer | Choice | Rationale |
|-------|--------|-----------|
| API Framework | FastAPI | Async, OpenAPI, Pydantic, performance |
| Workflow | LangGraph | Stateful, cyclic, human-in-the-loop, streaming |
| Scheduler | Ray Core | Distributed, actor model, GPU-aware, battle-tested |
| Message Bus | NATS JetStream | Durable, ordered, replayable, lightweight |
| Vector DB | Qdrant | Rust, fast, filtering, payload, Kubernetes-native |
| Time-series | TimescaleDB | PostgreSQL extension, automatic partitioning |
| Object Storage | MinIO | S3-compatible, erasure coding, Kubernetes-native |
| Auth | Keycloak | OIDC/SAML, RBAC, self-hosted, enterprise-ready |
| Frontend | Next.js 15 | RSC, streaming, Turbopack, best DX |
| UI Components | shadcn/ui | Accessible, customizable, Tailwind-native |
| Charts | Apache ECharts | Powerful, TypeScript, tree-shakable |
| Terminal | xterm.js | WebGL, addons, battle-tested |
| Tracing | OpenTelemetry + Jaeger | Vendor-neutral, auto-instrumentation |
| Metrics | Prometheus + Grafana | Industry standard, powerful queries |
| Container Runtime | Kata Containers + containerd | Hardware isolation, OCI-compatible |
| GPU Orchestration | NVIDIA GPU Operator | Device plugin, MIG, time-slicing, DCGM |

---

## Service Communication

```
┌─────────────┐     gRPC (protobuf)      ┌─────────────┐
│  Service A  │ ────────────────────────► │  Service B  │
└─────────────┘                            └─────────────┘
       │                                          │
       │ NATS JetStream (async events)            │
       ▼                                          ▼
┌─────────────┐                            ┌─────────────┐
│  Subject:   │                            │  Subject:   │
│  svc.a.evt  │                            │  svc.b.cmd  │
└─────────────┘                            └─────────────┘
```

**Patterns:**
- **Request/Response:** gRPC (low latency, typed)
- **Async Events:** NATS JetStream (durability, replay)
- **Real-time Push:** WebSocket (GUI updates)
- **Streaming:** Server-Sent Events / WebSocket (logs, metrics)

---

## Observability

### Metrics (Prometheus)
- `tenxo_jobs_total{status,framework,gpu_type}`
- `tenxo_job_duration_seconds{quantile}`
- `tenxo_gpu_utilization{node,gpu}`
- `tenxo_scheduler_score{node,factor}`
- `tenxo_billing_cost_cents{user,org}`
- `tenxo_node_health{node,component}`

### Traces (OpenTelemetry)
- `chat.plan` → `planner.plan` → `scheduler.schedule` → `deployment.generate` → `agent.execute`

### Logs (Structured JSON)
```json
{
  "timestamp": "2026-01-15T10:30:00Z",
  "level": "INFO",
  "service": "ai-planner",
  "trace_id": "abc123",
  "span_id": "def456",
  "message": "Plan generated",
  "plan_id": "plan_789",
  "confidence": 0.96
}
```

---

## Future Extensibility

- **Plugin System** — Custom frameworks, model loaders, schedulers
- **Multi-Cloud** — AWS/GCP/Azure GPU fleets via Cluster API
- **Federated Learning** — Secure multi-party computation
- **Serverless GPU** — Scale-to-zero with cold-start optimization
- **AI Agent Marketplace** — Deploy autonomous agents as workloads