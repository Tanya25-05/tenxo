#!/usr/bin/env bash
set -euo pipefail
# Minimal orchestrator for local dev: starts docker compose (NATS+Redis),
# waits for readiness, builds & runs backend, edge agent, and frontend.
# Usage: ./scripts/run_local.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Configurable env defaults
export NATS_URL="${NATS_URL:-nats://localhost:4222}"
export REDIS_ADDR="${REDIS_ADDR:-localhost:6379}"
export API_ADDR="${API_ADDR:-:8080}"
export PUBLIC_API_URL="${PUBLIC_API_URL:-http://localhost:8080}"
export AGENT_OWNER="${AGENT_OWNER:-local-dev}"
export AGENT_NODE_ID="${AGENT_NODE_ID:-node-1}"

# Helper: wait for TCP port
wait_for_port() {
  host=$1; port=$2; timeout=${3:-30}
  echo "Waiting for $host:$port (timeout ${timeout}s)..."
  t=0
  if command -v nc >/dev/null 2>&1; then
    while ! nc -z "$host" "$port"; do
      sleep 1; t=$((t+1)); if [ $t -ge $timeout ]; then return 1; fi
    done
  else
    # fallback using bash /dev/tcp
    while ! (echo > /dev/tcp/"$host"/"$port") >/dev/null 2>&1; do
      sleep 1; t=$((t+1)); if [ $t -ge $timeout ]; then return 1; fi
    done
  fi
  echo "$host:$port is ready"
  return 0
}

cleanup() {
  echo "Stopping children..."
  pkill -P $$ || true
}
trap cleanup EXIT

echo "1) Starting docker compose services (NATS with JetStream + Redis)..."
docker compose up -d nats redis

# Wait for NATS and Redis
wait_for_port "localhost" 4222 30
wait_for_port "localhost" 6379 30

echo "2) Build and run backend"
cd "$ROOT_DIR/backend"
# ensure deps are fetched
go mod tidy >/dev/null 2>&1 || true
go build -o mygrid-api ./main.go
# run backend in background, log to file
./mygrid-api > "$ROOT_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "backend pid=$BACKEND_PID (logs -> backend.log)"

# give backend a moment
sleep 1

echo "3) Build and run edge agent (one instance)"
cd "$ROOT_DIR/edge_agent"
cargo build --release
# run agent in background with minimal env
NATS_URL="$NATS_URL" OWNER="$AGENT_OWNER" NODE_ID="$AGENT_NODE_ID" ./target/release/edge_agent > "$ROOT_DIR/edge_agent.log" 2>&1 &
AGENT_PID=$!
echo "edge agent pid=$AGENT_PID (logs -> edge_agent.log)"

echo "4) Start frontend (if node installed)"
if [ -d "$ROOT_DIR/frontend" ]; then
  cd "$ROOT_DIR/frontend"
  if command -v npm >/dev/null 2>&1; then
    npm ci
    npm run dev > "$ROOT_DIR/frontend.log" 2>&1 &
    FRONTEND_PID=$!
    echo "frontend pid=$FRONTEND_PID (logs -> frontend.log)"
  else
    echo "npm not found; skip frontend"
  fi
fi

echo
echo "All started. Backend: http://localhost${API_ADDR#:}   Frontend: http://localhost:3000 (if started)"
echo "To view logs: tail -f backend.log edge_agent.log frontend.log"
wait