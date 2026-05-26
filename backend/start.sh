#!/bin/sh
set -e

NATS_PORT=${NATS_PORT:-4222}
NATS_STORE=${NATS_STORE:-/tmp/nats/data}

mkdir -p "$NATS_STORE"

nats-server \
  --port "$NATS_PORT" \
  --jetstream \
  --store_dir "$NATS_STORE" \
  --max_pending 65536 &

NATS_PID=$!

for i in $(seq 1 20); do
  if nc -z localhost "$NATS_PORT" 2>/dev/null; then
    echo "NATS ready on port $NATS_PORT"
    break
  fi
  sleep 0.3
done

if ! kill -0 "$NATS_PID" 2>/dev/null; then
  echo "NATS failed to start"
  exit 1
fi

exec /matchmaker
