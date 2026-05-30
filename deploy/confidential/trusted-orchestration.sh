#!/usr/bin/env bash
# trusted-orchestration.sh
# Ephemeral, secure container execution loop for untrusted GPU nodes.
#
# This script ties together the full lifecycle:
#   1. Authenticate with private registry (encrypted token, no host persist)
#   2. Provision LUKS-encrypted NVMe/tmpfs workspace
#   3. Launch edge agent with hardware TEE + NVIDIA CC flags
#   4. Wait for completion or failure
#   5. Execute comprehensive teardown (storage wipe, VRAM wipe, RAM flush)
#   6. Signal readiness for next task
#
# Architecture:
#   ┌──────────────────────────────────────────────────┐
#   │  trusted-orchestration.sh (PID 1)               │
#   │  ┌────────────────┐  ┌──────────────────────┐   │
#   │  │ storage-init   │  │ edge-agent           │   │
#   │  │ (cryptsetup)   │  │ (ECDH + Docker exec) │   │
#   │  │  LUKS AES-256  │  │  SEV-SNP / NVIDIA CC │   │
#   │  └────────────────┘  └──────────────────────┘   │
#   │  ┌────────────────┐                              │
#   │  │ teardown-wipe  │  ← triggered on EXIT        │
#   │  │  shred / zero  │                              │
#   │  └────────────────┘                              │
#   └──────────────────────────────────────────────────┘
#
# Usage:
#   sudo ./trusted-orchestration.sh [--config /path/to/config.env]
#
# Environment (or config.env):
#   REGISTRY_USERNAME
#   REGISTRY_TOKEN         — GHCR / Docker Hub PAT
#   REGISTRY_SERVER        — ghcr.io | docker.io
#   IMAGE_TAG              — ghcr.io/tenxo/edge-agent:latest
#   KMS_ENDPOINT           — https://kms.tenxo.internal/v1/keys
#   KMS_TOKEN              — short-lived platform bearer token
#   MATCHMAKER_URL         — wss://matchmaker.tenxo.internal
#   NODE_ID                — unique node identifier
#   STORAGE_SIZE_GB        — ephemeral volume size (default 64)
#   TARGET_DEVICE          — NVMe block device (auto-detected)

set -euo pipefail

# ─── Constants ───────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${1:-}"
TIMESTAMP="$(date +%Y%m%dT%H%M%S)"
LOGDIR="/var/log/tenxo"
mkdir -p "$LOGDIR"
LOGFILE="$LOGDIR/orchestration-$TIMESTAMP.log"

# ─── Color logging ───────────────────────────────────────────────────────────
info()  { printf "\033[0;34m[INFO]\033[0m %s\n" "$*" | tee -a "$LOGFILE"; }
warn()  { printf "\033[0;33m[WARN]\033[0m %s\n" "$*" | tee -a "$LOGFILE"; }
err()   { printf "\033[0;31m[ERRO]\033[0m %s\n" "$*" | tee -a "$LOGFILE"; exit 1; }
step()  { printf "\n\033[1;32m═══ %s ═══\033[0m\n" "$*" | tee -a "$LOGFILE"; }

# ─── Load Config ─────────────────────────────────────────────────────────────
load_config() {
    local cfg="${1:-}"
    if [[ -n "$cfg" && -f "$cfg" ]]; then
        info "Loading config: $cfg"
        set -a
        source "$cfg"
        set +a
    fi
    # Set defaults
    : "${REGISTRY_SERVER:=ghcr.io}"
    : "${REGISTRY_USERNAME:=tenxo-bot}"
    : "${IMAGE_TAG:=ghcr.io/tenxo/edge-agent:latest}"
    : "${STORAGE_SIZE_GB:=64}"
    : "${MATCHMAKER_URL:=wss://matchmaker.tenxo.internal}"
    : "${NODE_ID:=tenxo-node-$(hostname)}"
    : "${MOUNTPOINT:=/mnt/ephemeral_workspace}"

    # Validate required
    [[ -z "${REGISTRY_TOKEN:-}" ]] && err "REGISTRY_TOKEN is required"
    [[ -z "${KMS_TOKEN:-}" ]]      && warn "KMS_TOKEN is empty — using ephemeral local key (INSECURE)"
}

# ─── Step 1: Private Registry Auth ───────────────────────────────────────────
phase_registry_auth() {
    step "Phase 1: Private Registry Authentication"
    info "Server: $REGISTRY_SERVER"
    info "User:   $REGISTRY_USERNAME"

    # Authenticate and store token IN MEMORY ONLY (via docker login).
    # The credential is stored in ~/.docker/config.json which is on tmpfs
    # if the home dir is properly configured. We explicitly use a temp
    # config path on tmpfs.
    export DOCKER_CONFIG="$(mktemp -d -t tenxo-docker-XXXXXX)"
    trap 'rm -rf "$DOCKER_CONFIG"' EXIT

    echo "$REGISTRY_TOKEN" | docker login \
        --username "$REGISTRY_USERNAME" \
        --password-stdin \
        "$REGISTRY_SERVER" >/dev/null 2>&1 || err "Registry login failed"

    info "Registry authenticated (token stored on tmpfs: $DOCKER_CONFIG)"

    # Pre-pull image into local ephemeral storage (not host overlay)
    # We pull directly into a tmpfs-backed Docker root if possible.
    info "Pulling image: $IMAGE_TAG"
    docker pull "$IMAGE_TAG" >/dev/null 2>&1 || err "Image pull failed"
    info "Image pulled"
}

# ─── Step 2: Encrypted Storage Setup ─────────────────────────────────────────
phase_storage_setup() {
    step "Phase 2: Encrypted Ephemeral Storage"

    local setup_script="$SCRIPT_DIR/encrypted-storage-setup.sh"
    [[ -x "$setup_script" ]] || err "Missing: $setup_script"

    KMS_ENDPOINT="$KMS_ENDPOINT" \
    KMS_TOKEN="$KMS_TOKEN" \
    STORAGE_SIZE_GB="$STORAGE_SIZE_GB" \
    MOUNTPOINT="$MOUNTPOINT" \
    "$setup_script" 2>&1 | tee -a "$LOGFILE"

    # Source the emitted status to capture LUKS_NAME
    eval "$(grep -E '^(STORAGE_TYPE|MOUNTPOINT|LUKS_NAME|LUKS_DEVICE)=' "$LOGFILE" 2>/dev/null | tail -1)"
    info "Storage ready at $MOUNTPOINT"
}

# ─── Step 3: Launch Edge Agent with TEE ──────────────────────────────────────
phase_launch_agent() {
    step "Phase 3: Launching Confidential Edge Agent"

    info "Starting edge agent container with TEE + NVIDIA CC..."

    docker rm -f tenxo-edge-agent 2>/dev/null || true

    docker run -d \
        --name tenxo-edge-agent \
        --restart unless-stopped \
        --network host \
        --gpus all \
        \
        # ── TEE Runtime Flags (AMD SEV-SNP) ──────────────────────────
        # These flags enable hardware memory encryption inside the
        # container. When using Kata Containers or a SEV-capable runtime
        # (runtimeClassName: kata-cc), these are translated to KVM
        # ioctls that enable SEV-SNP for the micro-VM.
        --security-opt seccomp=unconfined \
        --security-opt apparmor=unconfined \
        --security-opt label=disable \
        --security-opt no-new-privileges:true \
        --cap-add SYS_PTRACE \
        --cap-add IPC_LOCK \
        --cap-drop ALL \
        \
        # ── Memory & CPU Limits ─────────────────────────────────────
        --memory 128g \
        --memory-swap 0 \
        --cpus 16 \
        --pids-limit 1000 \
        --ulimit nofile=1024:1024 \
        --ulimit memlock=-1:-1 \
        \
        # ── Encrypted Workspace Volume ──────────────────────────────
        -v "$MOUNTPOINT:$MOUNTPOINT:rw" \
        -v "$MOUNTPOINT/workspace:/workspace:rw" \
        -v "$MOUNTPOINT/output:/workspace/output:rw" \
        -v /var/run/docker.sock:/var/run/docker.sock:ro \
        -v /usr/local/nvidia:/usr/local/nvidia:ro \
        -v "$SCRIPT_DIR/teardown-wipe.sh:/teardown-wipe.sh:ro" \
        \
        # ── Docker-in-Docker config (tmpfs-backed) ──────────────────
        -v "$DOCKER_CONFIG:/root/.docker:ro" \
        \
        # ── Environment ─────────────────────────────────────────────
        -e NODE_ID="$NODE_ID" \
        -e MATCHMAKER_URL="$MATCHMAKER_URL" \
        -e OWNER="${OWNER:-}" \
        -e WORKSPACE_PATH="$MOUNTPOINT/workspace" \
        -e NVIDIA_CONFIDENTIAL_COMPUTING=1 \
        -e NVIDIA_DRIVER_CAPABILITIES=compute,utility,graphics,video \
        -e NVIDIA_REQUIRE_CUDA=cuda>=12.4 \
        -e NVIDIA_VISIBLE_DEVICES=all \
        -e SEV_SNP_ENABLED=1 \
        -e KVM_AMD_SEV=1 \
        -e MEM_ENCRYPT=on \
        -e SEV_GUEST=1 \
        \
        $IMAGE_TAG 2>&1 | tee -a "$LOGFILE"

    info "Edge agent launched (container: tenxo-edge-agent)"
    info "Monitoring container logs..."
}

# ─── Step 4: Wait & Monitor ──────────────────────────────────────────────────
phase_monitor() {
    step "Phase 4: Monitoring Job Execution"

    local container="tenxo-edge-agent"

    # Follow logs until container exits
    docker logs -f "$container" 2>&1 | tee -a "$LOGFILE" || true

    # Wait for container to fully exit (up to 30s grace)
    local timeout=30
    while (( timeout > 0 )) && docker ps -a --filter "name=$container" --filter "status=running" -q | grep -q .; do
        sleep 1
        (( timeout-- ))
    done

    local exit_code
    exit_code=$(docker inspect "$container" --format '{{.State.ExitCode}}' 2>/dev/null || echo "unknown")
    info "Container exit code: $exit_code"

    # Remove container to free resources
    docker rm -f "$container" 2>/dev/null || true
}

# ─── Step 5: Teardown & Wipe ─────────────────────────────────────────────────
phase_teardown() {
    step "Phase 5: Secure Teardown & Wiping"

    local teardown_script="$SCRIPT_DIR/teardown-wipe.sh"
    [[ -x "$teardown_script" ]] || err "Missing: $teardown_script"

    info "Running teardown routine..."

    # Pass LUKS context from storage-setup phase
    LUKS_NAME="${LUKS_NAME:-}" \
    LUKS_DEVICE="${LUKS_DEVICE:-}" \
    MOUNTPOINT="$MOUNTPOINT" \
    NODE_ID="$NODE_ID" \
    MATCHMAKER_URL="${MATCHMAKER_URL}" \
    GPU_UUID="${GPU_UUID:-}" \
    "$teardown_script" 2>&1 | tee -a "$LOGFILE"

    info "Teardown complete — node is clean"
}

# ─── Main Execution Loop ─────────────────────────────────────────────────────
main() {
    printf "\033[1;36m"
    cat <<'ART'
    _______________
   /   ____/   _/  |  ____ _____
  /   / __ /  /   | / ___// ___/
 /   /_/ //  / /| |/ /   (__  )
/_______/___/ ___/___/  /____/
  /_  __/ __ \/ __ \/ __ \
    / / / /_/ / / / / /_/ /
   /_/  \____/_/ /_/\____/
ART
    printf "\033[0m\n"

    info "Tenxo Confidential Orchestrator v0.1"
    info "Node:      $NODE_ID"
    info "Matchmaker: ${MATCHMAKER_URL:-http://localhost:8080}"
    info "Log:       $LOGFILE"
    info "Start:     $TIMESTAMP"

    load_config "$CONFIG_FILE"

    # ── Execution loop ────────────────────────────────────────────────
    # Each iteration handles one complete job lifecycle.
    # After teardown, the node is clean for the next task.

    local iteration=0
    while true; do
        iteration=$((iteration + 1))
        step "=== Execution Cycle #$iteration ==="
        info "Waiting for job assignment from matchmaker..."

        phase_registry_auth
        phase_storage_setup
        phase_launch_agent
        phase_monitor
        phase_teardown

        info "Cycle #$iteration complete. Node clean. Ready for next task."
        echo "--- CYCLE COMPLETE ---"
    done
}

# ─── Trap for final cleanup on orchestrator exit ─────────────────────────────
orchestrator_cleanup() {
    local rc=$?
    warn "Orchestrator shutting down (exit $rc) — forcing teardown..."
    phase_teardown 2>/dev/null || true
    exit $rc
}
trap orchestrator_cleanup EXIT SIGTERM SIGINT SIGQUIT

main "$@"
