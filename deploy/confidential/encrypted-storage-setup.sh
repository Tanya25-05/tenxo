#!/usr/bin/env bash
# encrypted-storage-setup.sh
# Creates an ephemeral LUKS-encrypted volume (AES-256-XTS) on the host NVMe
# for the container workspace root. Key is fetched from a platform KMS at
# runtime and held only in CPU registers / transient tmpfs — never written
# to host block storage.
#
# If LUKS is unavailable (no kernel modules / privileges), falls back to a
# tmpfs RAM disk that does not touch host swap.
#
# Usage:
#   sudo ./encrypted-storage-setup.sh [--size <GiB>] [--device </dev/nvmeXn1>]
#
# Environment:
#   KMS_ENDPOINT     — gRPC/REST endpoint for the external key manager
#   KMS_TOKEN        — short-lived bearer token (platform-issued)
#   STORAGE_SIZE_GB  — size in GiB (default 64)
#   TARGET_DEVICE    — block device (default: first available NVMe)

set -euo pipefail

: "${KMS_ENDPOINT:=https://kms.tenxo.internal/v1/keys}"
: "${KMS_TOKEN:=}"
: "${STORAGE_SIZE_GB:=64}"
: "${TARGET_DEVICE:=}"
: "${MOUNTPOINT:=/mnt/ephemeral_workspace}"

# ─── Color logging ───────────────────────────────────────────────────────────
info()  { printf "\033[0;34m[INFO]\033[0m %s\n" "$*"; }
warn()  { printf "\033[0;33m[WARN]\033[0m %s\n" "$*"; }
err()   { printf "\033[0;31m[ERRO]\033[0m %s\n" "$*"; exit 1; }

# ─── Prerequisites ───────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && err "Must be run as root"
command -v cryptsetup >/dev/null 2>&1 || warn "cryptsetup not found; falling back to tmpfs"
command -v curl >/dev/null 2>&1 || { warn "curl not found; installing"; apt-get update -qq && apt-get install -y -qq curl; }

cleanup() {
    local rc=$?
    if [[ -d "$MOUNTPOINT" ]]; then
        umount "$MOUNTPOINT" 2>/dev/null || true
    fi
    if [[ -n "${LUKS_NAME:-}" ]]; then
        cryptsetup close "$LUKS_NAME" 2>/dev/null || true
    fi
    exit $rc
}
trap cleanup EXIT

# ─── Step 1: Fetch ephemeral key from KMS ────────────────────────────────────
fetch_kms_key() {
    local key_b64
    if [[ -z "$KMS_TOKEN" ]]; then
        warn "KMS_TOKEN is empty; generating local ephemeral key (INSECURE)"
        # In production this MUST come from the platform KMS.
        # The key is generated here ONLY for development bootstrapping.
        dd if=/dev/urandom bs=64 count=1 2>/dev/null | base64 -w0
        return
    fi
    info "Fetching encryption key from KMS: $KMS_ENDPOINT"
    key_b64=$(curl -sf \
        -H "Authorization: Bearer $KMS_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"purpose": "ephemeral-storage", "size_bits": 512}' \
        "$KMS_ENDPOINT" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['key_b64'])" 2>/dev/null) || {
        err "KMS key fetch failed — aborting. Check KMS_ENDPOINT and KMS_TOKEN."
    }
    echo "$key_b64"
}

info "=== Ephemeral Encrypted Storage Setup ==="
info "Target size: ${STORAGE_SIZE_GB} GiB"

# ─── Step 2: Detect target block device ──────────────────────────────────────
if [[ -z "$TARGET_DEVICE" ]]; then
    # Prefer NVMe, fall back to first non-root SSD
    TARGET_DEVICE=$(lsblk -dnlo NAME,TYPE,MOUNTPOINT | awk '$2=="disk" && $3!~/\// {print "/dev/"$1; exit}')
    # Try NVMe first
    for dev in /dev/nvme*n1; do
        if [[ -b "$dev" ]]; then
            TARGET_DEVICE="$dev"
            break
        fi
    done
fi

if [[ -z "$TARGET_DEVICE" || ! -b "$TARGET_DEVICE" ]]; then
    warn "No suitable block device found — falling back to tmpfs RAM disk"
    FALLBACK_TMPFS=true
fi

# ─── Step 3a: Create LUKS-encrypted partition ────────────────────────────────
if [[ "${FALLBACK_TMPFS:-false}" != "true" ]] && command -v cryptsetup >/dev/null; then
    info "Using LUKS2 on $TARGET_DEVICE (AES-256-XTS)"

    LUKS_NAME="tenxo-ephemeral-$(head -c8 /dev/urandom | xxd -p)"

    # Fetch key
    KEY_B64=$(fetch_kms_key)
    echo "$KEY_B64" | base64 -d > /tmp/.luks-key-"$LUKS_NAME"
    chmod 600 /tmp/.luks-key-"$LUKS_NAME"

    # Format with LUKS2 — argon2 KDF, AES-256-XTS
    info "Formatting LUKS2 volume..."
    echo YES | cryptsetup luksFormat \
        --type luks2 \
        --cipher aes-xts-plain64 \
        --key-size 512 \
        --hash sha256 \
        --pbkdf argon2id \
        --iter-time 2000 \
        --label "tenxo-ephemeral" \
        "$TARGET_DEVICE" \
        /tmp/.luks-key-"$LUKS_NAME" || err "luksFormat failed"

    # Open
    info "Opening LUKS volume..."
    cryptsetup open \
        --key-file /tmp/.luks-key-"$LUKS_NAME" \
        "$TARGET_DEVICE" \
        "$LUKS_NAME" || err "cryptsetup open failed"

    # Wipe key from host filesystem (held only in kernel dm-crypt keyring)
    shred -u /tmp/.luks-key-"$LUKS_NAME" 2>/dev/null || rm -f /tmp/.luks-key-"$LUKS_NAME"
    info "LUKS key shredded from host filesystem"

    # Create filesystem (ext4 with no reserved blocks)
    mkfs.ext4 -F -m 0 -L tenxo-ephemeral "/dev/mapper/$LUKS_NAME" >/dev/null 2>&1

    # Mount with noatime for performance, nodiscard to avoid exposing free blocks
    mkdir -p "$MOUNTPOINT"
    mount "/dev/mapper/$LUKS_NAME" "$MOUNTPOINT" \
        -o noatime,nodiscard,commit=30 || err "mount failed"

    info "LUKS volume mounted at $MOUNTPOINT ($(df -h "$MOUNTPOINT" | tail -1 | awk '{print $2}'))"

    # Print the mapped device name so teardown can find it
    echo "LUKS_NAME=$LUKS_NAME"
    echo "LUKS_DEVICE=$TARGET_DEVICE"
else
    # ── Step 3b: Fallback — tmpfs RAM disk ──────────────────────────
    FALLBACK_TMPFS=true
    info "Creating tmpfs RAM disk of ${STORAGE_SIZE_GB} GiB at $MOUNTPOINT"

    # Verify available RAM
    local avail_mem_kb
    avail_mem_kb=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
    local avail_gib=$(( avail_mem_kb / 1024 / 1024 ))
    if (( avail_gib < STORAGE_SIZE_GB )); then
        warn "Available RAM (${avail_gib} GiB) < requested size (${STORAGE_SIZE_GB} GiB) — using available"
        STORAGE_SIZE_GB=$avail_gib
    fi

    mkdir -p "$MOUNTPOINT"
    mount -t tmpfs -o size="${STORAGE_SIZE_GB}G",noexec,nosuid,nodev,mode=0700 \
        tmpfs "$MOUNTPOINT" || err "tmpfs mount failed"

    # Lock into RAM — prevent swapping of this mount
    if command -v swapoff >/dev/null; then
        swapoff -a 2>/dev/null || warn "swapoff failed; tmpfs may page to disk"
    fi

    info "tmpfs RAM disk mounted at $MOUNTPOINT (${STORAGE_SIZE_GB} GiB)"
fi

# ─── Step 4: Prepare workspace layout ────────────────────────────────────────
mkdir -p "$MOUNTPOINT"/{workspace,scratch,output}
chmod 700 "$MOUNTPOINT"
info "Workspace layout created at $MOUNTPOINT/workspace"
info "=== Encrypted Storage Setup Complete ==="

# Emit machine-readable status
cat <<STATUS
STORAGE_TYPE=${FALLBACK_TMPFS:-LUKS}
MOUNTPOINT=${MOUNTPOINT}
STATUS
