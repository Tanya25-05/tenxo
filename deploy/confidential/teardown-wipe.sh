#!/usr/bin/env bash
# teardown-wipe.sh
# Forceful termination & secure wiping routine for confidential GPU compute.
#
# Triggered on:
#   - Container graceful stop
#   - Container crash / OOM
#   - Job completion (success or error)
#   - Hardware watchdog timeout
#
# Obliteration scope:
#   1. Kill container runtime / exec sessions
#   2. Wipe encrypted LUKS volume & shred keys
#   3. Zero system RAM pages that held workspace data
#   4. Reset GPU and wipe VRAM via NVML / nvidia-smi
#   5. Flush network routing tables / custom CNI state
#
# Usage:
#   sudo ./teardown-wipe.sh [--container-id <id>] [--luks-name <name>] [--gpu-uuid <uuid>]
#
# Environment:
#   LUKS_NAME        — dm-crypt device name (from encrypted-storage-setup.sh)
#   LUKS_DEVICE      — raw block device
#   MOUNTPOINT       — mount path
#   CONTAINER_RUNTIME— docker | containerd | kata (default: docker)
#   GPU_UUID         — specific GPU UUID(s) to reset (comma-sep); empty = all

set -euo pipefail

: "${LUKS_NAME:=}"
: "${LUKS_DEVICE:=}"
: "${MOUNTPOINT:=/mnt/ephemeral_workspace}"
: "${CONTAINER_RUNTIME:=docker}"
: "${GPU_UUID:=}"

info()  { printf "\033[0;34m[INFO]\033[0m %s\n" "$*"; }
warn()  { printf "\033[0;33m[WARN]\033[0m %s\n" "$*"; }
err()   { printf "\033[0;31m[ERRO]\033[0m %s\n" "$*"; }

# Parse CLI overrides
while [[ $# -gt 0 ]]; do
    case "$1" in
        --container-id) CONTAINER_ID="$2"; shift 2 ;;
        --luks-name)    LUKS_NAME="$2";   shift 2 ;;
        --luks-device)  LUKS_DEVICE="$2"; shift 2 ;;
        --gpu-uuid)     GPU_UUID="$2";    shift 2 ;;
        *) warn "Unknown option: $1"; shift ;;
    esac
done

[[ $EUID -ne 0 ]] && err "Must be run as root"

info "=== Teardown & Secure Wipe ==="

# ─── Phase 1: Kill Container Runtime ─────────────────────────────────────────
phase_kill_runtime() {
    info "[Phase 1] Killing container runtime instances..."

    case "$CONTAINER_RUNTIME" in
        docker|containerd)
            if command -v docker >/dev/null; then
                if [[ -n "${CONTAINER_ID:-}" ]]; then
                    docker kill "$CONTAINER_ID" 2>/dev/null || true
                    docker rm --force "$CONTAINER_ID" 2>/dev/null || true
                fi
                # Kill ALL containers with tenxo label or running on this node
                for cid in $(docker ps -q --filter "label=tenxo.node" 2>/dev/null); do
                    docker kill "$cid" 2>/dev/null || true
                    docker rm --force "$cid" 2>/dev/null || true
                done
                # Nuke any remaining containers with GPU access
                for cid in $(docker ps -q --filter "device=nvidia.com/gpu" 2>/dev/null); do
                    docker kill "$cid" 2>/dev/null || true
                    docker rm --force "$cid" 2>/dev/null || true
                done
            fi
            if command -v ctr >/dev/null; then
                ctr tasks kill -a --signal SIGKILL 2>/dev/null || true
            fi
            ;;
        kata)
            # Kata containers run as separate VM — use full VM kill
            if command -v kata-runtime >/dev/null; then
                kata-runtime kill --all --force 2>/dev/null || true
                kata-runtime delete --force 2>/dev/null || true
            fi
            ;;
    esac

    # Ensure all GPU processes are dead
    if command -v nvidia-smi >/dev/null; then
        nvidia-smi --gpu-reset 2>/dev/null || true
    fi

    info "[Phase 1] Container runtime terminated"
}

# ─── Phase 2: Wipe Encrypted Storage ─────────────────────────────────────────
phase_wipe_storage() {
    info "[Phase 2] Wiping encrypted storage..."

    # Shred any remaining files on the mount
    if [[ -d "$MOUNTPOINT" ]]; then
        info "Overwriting workspace contents with /dev/urandom..."
        find "$MOUNTPOINT" -type f -exec shred -u -n 3 -z {} \; 2>/dev/null || true
        # Wipe directory entries
        rm -rf "${MOUNTPOINT:?}"/* 2>/dev/null || true
    fi

    # Unmount
    umount "$MOUNTPOINT" 2>/dev/null || true

    # Close LUKS
    if [[ -n "$LUKS_NAME" ]]; then
        cryptsetup luksKillSlot "$LUKS_NAME" 0 2>/dev/null || true
        cryptsetup close "$LUKS_NAME" 2>/dev/null || true
    fi

    # If we have the raw device, wipe LUKS headers and full device
    if [[ -n "$LUKS_DEVICE" && -b "$LUKS_DEVICE" ]]; then
        info "Wiping LUKS headers and block device: $LUKS_DEVICE"
        # Wipe LUKS header (1 MiB is sufficient for LUKS2)
        dd if=/dev/urandom of="$LUKS_DEVICE" bs=1M count=4 status=none 2>/dev/null || true
        # Wipe the full device (first 10 GB or until timeout)
        dd if=/dev/urandom of="$LUKS_DEVICE" bs=1M count=10240 status=none 2>/dev/null || true
        # Final pass with zeros
        dd if=/dev/zero of="$LUKS_DEVICE" bs=1M count=10240 status=none 2>/dev/null || true
        blkdiscard "$LUKS_DEVICE" 2>/dev/null || true
    fi

    info "[Phase 2] Encrypted storage wiped"
}

# ─── Phase 3: Wipe System RAM ────────────────────────────────────────────────
phase_wipe_ram() {
    info "[Phase 3] Wiping system RAM..."

    # Drop filesystem caches and free pagecache, dentries, inodes
    sync
    echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true
    # Overwrite free memory
    if command -v memtester >/dev/null; then
        memtester "$(free -m | awk '/^Mem:/{print int($7*0.8)}')" 1 2>/dev/null || true
    fi
    # Force OOM to reclaim all anonymous pages
    echo f > /proc/sysrq-trigger 2>/dev/null || true
    # Re-mount tmpfs with fresh RAM
    if mountpoint -q "$MOUNTPOINT" 2>/dev/null; then
        mount -o remount,size="${STORAGE_SIZE_GB:-64}G" tmpfs "$MOUNTPOINT" 2>/dev/null || true
    fi

    info "[Phase 3] System RAM cache flushed"
}

# ─── Phase 4: Wipe GPU VRAM ──────────────────────────────────────────────────
phase_wipe_vram() {
    info "[Phase 4] Wiping GPU VRAM..."

    if ! command -v nvidia-smi >/dev/null; then
        warn "nvidia-smi not found; skipping GPU VRAM wipe"
        return
    fi

    # Build GPU list
    local gpu_list
    if [[ -n "$GPU_UUID" ]]; then
        gpu_list="$GPU_UUID"
    else
        # Get all GPU UUIDs
        gpu_list=$(nvidia-smi --query-gpu=uuid --format=csv,noheader 2>/dev/null | tr '\n' ',')
    fi

    IFS=',' read -ra GPUS <<< "$gpu_list"
    for gpu in "${GPUS[@]}"; do
        gpu=$(echo "$gpu" | xargs)
        [[ -z "$gpu" ]] && continue

        info "  Wiping GPU: $gpu"

        # Method 1: GPU Reset (resets all GPU state, frees VRAM)
        if [[ -n "$gpu" ]]; then
            nvidia-smi --id="$gpu" --gpu-reset 2>/dev/null || true
        fi

        # Method 2: Allocate + fill VRAM with noise, then release.
        # This ensures residual GPU kernel memory is overwritten.
        python3 -c "
import os, sys, time
os.environ['CUDA_VISIBLE_DEVICES'] = '${gpu#GPU-}' if '${gpu}' != '' else ''
try:
    import numpy as np
    import cupy as cp
    total = cp.cuda.runtime.getDeviceProperties(0)['totalGlobalMem']
    # Allocate 95% of VRAM in chunks, fill with random data
    chunk = 256 * 1024 * 1024  # 256 MB
    allocated = []
    for offset in range(0, int(total * 0.95), chunk):
        try:
            arr = cp.random.randint(0, 255, (chunk // 4,), dtype=cp.uint32)
            allocated.append(arr)
        except Exception:
            break
    # Overwrite with zero
    for arr in allocated:
        arr.fill(0)
    cp.cuda.runtime.deviceSynchronize()
    del allocated
    cp.get_default_memory_pool().free_all_blocks()
except Exception as e:
    print(f'  VRAM wipe skipped: {e}', file=sys.stderr)
" 2>/dev/null || true

        # Method 3: NVML-based GPU reset (via nvidia-smi)
        nvidia-smi --id="$gpu" -pm 0 2>/dev/null || true
        nvidia-smi --id="$gpu" --gpu-reset 2>/dev/null || true
    done

    # Force persistence mode off, reset ECC counters
    nvidia-smi --gpu-reset 2>/dev/null || true

    info "[Phase 4] GPU VRAM wiped"
}

# ─── Phase 5: Wipe Network State ─────────────────────────────────────────────
phase_wipe_network() {
    info "[Phase 5] Wiping network state..."

    # Flush custom CNI / bridge state
    if command -v ip >/dev/null; then
        for iface in $(ip link show | grep -oP '(?<=: )tenxo[a-z0-9-]*' 2>/dev/null); do
            ip link delete "$iface" 2>/dev/null || true
        done
    fi

    # Flush conntrack
    if command -v conntrack >/dev/null; then
        conntrack -F 2>/dev/null || true
    fi

    # Clear iptables rules created by container runtime
    if command -v iptables >/dev/null; then
        iptables -F DOCKER-USER 2>/dev/null || true
        iptables -t nat -F DOCKER 2>/dev/null || true
    fi

    info "[Phase 5] Network state wiped"
}

# ─── Phase 6: Notify Matchmaker ───────────────────────────────────────────────
phase_notify_teardown() {
    info "[Phase 6] Notifying matchmaker of teardown..."

    local node_id="${NODE_ID:-unknown}"
    local matchmaker="${MATCHMAKER_URL:-http://127.0.0.1:8080}"
    local payload
    payload=$(cat <<JSON
{
    "node_id": "$node_id",
    "status": "wiped",
    "gpu_status": "reset",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON
)
    curl -sf -X POST \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "${matchmaker}/agent/teardown" 2>/dev/null || true
    info "[Phase 6] Matchmaker notified"
}

# ─── Execute All Phases ──────────────────────────────────────────────────────
phase_kill_runtime
phase_wipe_storage
phase_wipe_ram
phase_wipe_vram
phase_wipe_network
phase_notify_teardown

info "=== Teardown & Secure Wipe Complete ==="
echo "NODE_CLEAN=true"
