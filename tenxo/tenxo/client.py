"""
HTTP client for Tenxo zero-trust job submission protocol.

Protocol:
  1. CLI fetches agent's TEE attestation quote + ephemeral X25519 pubkey
  2. CLI verifies the TEE quote against AMD certificate chain
  3. CLI generates its own ephemeral X25519 keypair
  4. CLI computes ECDH shared secret (matchmaker never sees it)
  5. CLI derives AES-256-GCM payload key via HKDF
  6. CLI pads workspace to standard tier, encrypts, uploads
  7. CLI submits job with HKDF salt (not the AES key)
  8. Agent derives same AES key from shared_secret + salt
  9. Agent downloads, decrypts IN-TEE, executes, re-encrypts
  10. CLI polls, downloads, decrypts result
"""

from __future__ import annotations

import json
import os
import sys
import time
import tempfile
from pathlib import Path
from typing import Optional

import requests

try:
    from tqdm import tqdm

    def _progress(total: int, desc: str = ""):
        return tqdm(total=total, unit="B", unit_scale=True, desc=desc)
except ImportError:
    def _progress(total: int, desc: str = ""):
        class _Nop:
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass
            def update(self, n):
                pass
        return _Nop()

from .crypto import (  # noqa: E402
    EphemeralKeyPair,
    TeeQuote,
    blind_aes_key,
    compute_shared_secret,
    derive_aes_key,
    encrypt_payload,
    decrypt_payload,
    encrypt_file,
    verify_tee_quote,
    verify_encrypted_size,
    pad_payload,
    unpad_payload,
)

try:
    import websockets.sync.client as ws_client
    HAS_WS = True
except ImportError:
    HAS_WS = False

CONFIG_DIR = Path.home() / ".tenxo"
CONFIG_PATH = CONFIG_DIR / "config.json"


def _config() -> dict:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    if CONFIG_PATH.is_file():
        return json.loads(CONFIG_PATH.read_text())
    return {}


def _save_config(cfg: dict):
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2))


def cmd_init(api_url: str, api_key: str | None = None):
    cfg = _config()
    cfg["api_url"] = api_url
    if api_key:
        cfg["api_key"] = api_key
    _save_config(cfg)
    print(f"Saved config to {CONFIG_PATH}")


def cmd_list(api_url: str | None = None, api_key: str | None = None):
    """List available GPU nodes on the grid."""
    cfg = _config()
    api_url = api_url or cfg.get("api_url")
    if not api_url:
        print("No API URL configured. Run: tenxo init --api-url <url>")
        sys.exit(1)

    api_key = api_key or cfg.get("api_key")
    headers = {}
    if api_key:
        headers["X-API-Key"] = api_key

    resp = requests.get(
        f"{api_url.rstrip('/')}/nodes",
        headers=headers,
        timeout=10,
    )
    if resp.status_code == 401:
        print("Unauthorized. Run: tenxo init --api-url <url> --api-key <jwt_or_key>")
        sys.exit(1)
    resp.raise_for_status()
    nodes = resp.json().get("nodes", [])

    if not nodes:
        print("No GPU nodes currently online.")
        return

    # Aggregate by GPU model
    sku_map: dict[str, list[dict]] = {}
    for n in nodes:
        model = n.get("gpu_model") or "Unknown"
        sku_map.setdefault(model, []).append(n)

    total_vram = sum(n.get("gpu_vram_mb", 0) for n in nodes)
    idle = [n for n in nodes if n.get("status") == "idle"]

    print(f"\n  Tenxo GPU Grid  —  {len(nodes)} node(s) online, {len(idle)} idle\n")
    print(f"  {'GPU Model':<30} {'Count':>6} {'VRAM':>10} {'Status'}")
    print(f"  {'─'*30} {'─'*6} {'─'*10} {'─'*10}")

    for model in sorted(sku_map):
        group = sku_map[model]
        count = len(group)
        vram_each = group[0].get("gpu_vram_mb", 0)
        vram_total = sum(n.get("gpu_vram_mb", 0) for n in group)
        idle_count = sum(1 for n in group if n.get("status") == "idle")
        vram_str = (
            f"{vram_each // 1024} GB" if vram_each else "?"
        )
        status = f"{idle_count}/{count} idle"
        print(f"  {model:<30} {count:>6} {vram_str:>10} {status}")

    print(f"\n  Total VRAM: {total_vram // 1024} GB")
    print(f"\n  Use: tenxo run --gpu \"<GPU Model>\" ./workspace\n")


# ─── Zero-Trust ECDH Key Exchange ──────────────────────────────────────────

def perform_key_exchange(
    api_url: str, headers: dict, gpu_model: str | None = None, node_id: str | None = None
) -> tuple[bytes, bytes, bytes, str]:
    """Perform ECDH key exchange via zero-knowledge signaling.

    The matchmaker routes public keys and TEE quotes without inspecting them.

    Args:
        api_url: Backend API URL.
        headers: Auth headers (X-API-Key or Authorization).
        gpu_model: Optional GPU SKU filter (e.g. "NVIDIA RTX 4090", "A100").
                   If None, picks the first available node.
        node_id: Specific node ID to deploy on (overrides gpu_model filter).

    Returns:
        Tuple of (shared_secret: 32 bytes, client_pubkey: 32 bytes, agent_pubkey: 32 bytes, node_id: str).
    """
    ws_url = api_url.rstrip('/').replace("http://", "ws://").replace("https://", "wss://")

    # ── Step 1: Find available nodes ──────────────────────────────────
    nodes_resp = requests.get(
        f"{api_url.rstrip('/')}/nodes",
        headers=headers,
        timeout=10,
    )
    nodes_resp.raise_for_status()
    nodes = nodes_resp.json().get("nodes", [])
    if not nodes:
        print("No available GPU nodes found.")
        sys.exit(1)

    if node_id:
        node = next((n for n in nodes if n.get("node_id") == node_id), None)
        if not node:
            print(f"Node '{node_id}' not found or offline.")
            sys.exit(1)
        print(f"Selected GPU node: {node_id} ({node.get('gpu_model', '?')})")
    else:
        if gpu_model:
            gpu_lower = gpu_model.lower()
            filtered = [
                n for n in nodes
                if gpu_lower in (n.get("gpu_model") or "").lower()
            ]
            if not filtered:
                available = ", ".join(
                    sorted(set(n.get("gpu_model", "?") for n in nodes))
                )
                print(f"No nodes matching GPU '{gpu_model}'. Available: {available}")
                sys.exit(1)
            nodes = filtered
            print(f"Filtered to {len(nodes)} node(s) matching GPU '{gpu_model}'")
        node = nodes[0]

    node_id = node.get("node_id")
    print(f"Established session with node: {node_id}")

    # ── Step 2: Generate Client ephemeral X25519 keypair ────────────────
    client_keypair = EphemeralKeyPair.generate()
    client_pub_b64 = client_keypair.public_key_b64

    # ── Step 3: Retry signaling (agent WS may reconnect) ───────────────
    max_attempts = 3
    session_id = None
    agent_pub_bytes = None
    shared_secret = None

    for attempt in range(max_attempts):
        session_id = None

        # Look up the active session for this node
        try:
            sess_resp = requests.get(
                f"{api_url.rstrip('/')}/signal/session-for-node",
                params={"node_id": node_id},
                headers=headers,
                timeout=10,
            )
            if sess_resp.ok:
                sess_data = sess_resp.json()
                session_id = sess_data.get("session_id")
        except Exception:
            pass

        if not session_id:
            if attempt < max_attempts - 1:
                wait = 2 * (attempt + 1)
                print(f"No active signaling session for node (attempt {attempt+1}/{max_attempts}), retrying in {wait}s...")
                time.sleep(wait)
                continue
            else:
                break

        # ── Step 3a: WebSocket signaling ──────────────────────────────
        if HAS_WS:
            try:
                with ws_client.connect(f"{ws_url}/signal/client?session={session_id}",
                                        close_timeout=10) as ws:
                    raw = ws.recv(timeout=15)
                    msg = json.loads(raw)
                    if msg.get("type") == "tee_quote":
                        quote = TeeQuote.deserialize(msg["payload"])

                    print("Verifying agent TEE attestation quote...")
                    report_data = quote.report_data
                    agent_pub_bytes = report_data[:32]

                    verify_tee_quote(quote, agent_pub_bytes)
                    print("TEE quote verified successfully")

                    shared_secret = compute_shared_secret(
                        client_keypair.private_key, agent_pub_bytes
                    )

                    ws.send(json.dumps({
                        "type": "client_pub_key",
                        "payload": {"pub_key": client_pub_b64},
                    }))
                    print("Client pubkey sent via WebSocket signaling")
                    break

            except Exception as e:
                print(f"WebSocket signaling failed (attempt {attempt+1}/{max_attempts}): {e}")

        # ── Step 3b: REST fallback ────────────────────────────────────
        if shared_secret is None:
            try:
                session_resp = requests.get(
                    f"{api_url.rstrip('/')}/signal/session?session={session_id}",
                    headers=headers,
                    timeout=10,
                )
                if session_resp.ok:
                    session_data = session_resp.json()
                    quote_data = session_data.get("quote")
                    if quote_data:
                        quote = TeeQuote.deserialize(quote_data)
                        report_data = quote.report_data
                        agent_pub_bytes = report_data[:32]

                        verify_tee_quote(quote, agent_pub_bytes)
                        print("TEE quote verified successfully (REST)")

                        shared_secret = compute_shared_secret(
                            client_keypair.private_key, agent_pub_bytes
                        )

                        requests.post(
                            f"{api_url.rstrip('/')}/signal/client-key?session={session_id}",
                            headers=headers,
                            json={"pub_key": client_pub_b64},
                            timeout=10,
                        )
                        break
            except Exception:
                pass

        if shared_secret is None and attempt < max_attempts - 1:
            wait = 2 * (attempt + 1)
            print(f"Signaling failed, retrying in {wait}s...")
            time.sleep(wait)

    # ── Step 4: Error out if signaling failed ─────────────────────────
    if shared_secret is None:
        print("ERROR: Could not establish secure signaling with agent.")
        print("  Possible causes:")
        print("  - The edge agent is not running or has disconnected")
        print("  - The agent's WebSocket connection dropped (check agent logs)")
        print("  - Network/firewall is blocking WebSocket connections")
        print("  Set NODE_ID env var on the agent to a fixed value for stability")
        sys.exit(1)

    assert agent_pub_bytes is not None

    print("ECDH key exchange complete (matchmaker never saw shared secret)")
    return shared_secret, client_keypair.public_key_bytes, agent_pub_bytes, node_id


# ─── Upload with Progress ──────────────────────────────────────────────────

def _upload_with_progress(url: str, file_path: Path):
    total = file_path.stat().st_size
    with open(file_path, "rb") as f:
        data = f.read()
    resp = requests.put(
        url,
        data=data,
        headers={"Content-Length": str(total)},
    )
    resp.raise_for_status()
    return resp


# ─── Main Job Submission ───────────────────────────────────────────────────

def cmd_run(
    path: str,
    api_url: str | None = None,
    api_key: str | None = None,
    timeout: int = 600,
    gpu_model: str | None = None,
    node_id: str | None = None,
    presign_ttl: int | None = None,
):
    cfg = _config()
    api_url = api_url or cfg.get("api_url")
    if not api_url:
        print("No API URL configured. Run: tenxo init --api-url <url>")
        sys.exit(1)

    api_key = api_key or cfg.get("api_key")

    root = Path(path).resolve()
    if not root.exists():
        print(f"Path not found: {root}")
        sys.exit(1)

    headers = {}
    if api_key:
        headers["X-API-Key"] = api_key

    from .pack import pack_workspace

    with tempfile.TemporaryDirectory() as td:
        td_path = Path(td)
        zip_path = pack_workspace(root, td_path / "workspace.zip")

        # ── Step 1: ECDH Key Exchange ──────────────────────────────────
        shared_secret, client_pubkey, agent_pubkey, node_id = perform_key_exchange(
            api_url, headers, gpu_model=gpu_model, node_id=node_id
        )

        # ── Step 2: HKDF Derive AES-256-GCM Key ───────────────────────
        # The salt is sent with the job; the agent derives the same key from
        # (shared_secret, salt). The matchmaker sees only the salt.
        aes_key, salt = derive_aes_key(shared_secret)
        # XOR-blind: final_key = aes_key XOR shared_secret
        # The matchmaker never sees shared_secret, so even with the salt
        # and encrypted payload they cannot derive the final key.
        final_key = blind_aes_key(aes_key, shared_secret)
        salt_b64 = __import__("base64").b64encode(salt).decode()
        print("AES-256-GCM payload key derived via HKDF-SHA256 and XOR-blinded")

        # ── Step 3: Encrypt workspace with padding ─────────────────────
        enc_path = td_path / "workspace.zip.enc"
        encrypt_file(zip_path, enc_path, final_key)
        print(f"Encrypted and padded workspace -> {enc_path}")
        print(f"  Original: {zip_path.stat().st_size} bytes")
        print(f"  Encrypted: {enc_path.stat().st_size} bytes")

        # ── Step 4: Get presigned upload URL ───────────────────────────
        # We do NOT send the key to the matchmaker. We send only the salt.
        presign_url = f"{api_url.rstrip('/')}/presign"
        print(f"Requesting upload URL from {presign_url}")
        presign_body = {
            "job_id": "",
            "enc_key_b64": "",  # Intentionally empty — zero-knowledge
        }
        if presign_ttl is not None and presign_ttl > 0:
            presign_body["ttl_seconds"] = presign_ttl
            print(f"  Presigned URL TTL: {presign_ttl}s")
        try:
            r = requests.post(
                presign_url,
                headers=headers,
                json=presign_body,
                timeout=10,
            )
            r.raise_for_status()
            pres = r.json()
            upload_url = pres["upload_url"]
            result_url = pres.get("result_url")
            job_id = pres.get("job_id")
        except Exception as e:
            print(f"Failed to get presigned URLs: {e}")
            sys.exit(1)

        # ── Step 5: Verify encrypted size (plausible deniability check) ─
        enc_bytes = enc_path.read_bytes()
        try:
            tier = verify_encrypted_size(enc_bytes)
            print(f"Encrypted payload matches tier: {tier // (1024**3)} GB")
        except ValueError as e:
            print(f"WARNING: {e}")

        # ── Step 6: Upload encrypted payload ───────────────────────────
        _upload_with_progress(upload_url, enc_path)

        # ── Step 7: Submit job (salt only, NOT the AES key) ──────────
        job_post = {
            "job_id": job_id,
            "encrypted_job_link": upload_url,
            # ZERO-KNOWLEDGE: salt_b64 instead of enc_key_b64
            "salt_b64": salt_b64,
            # Include client pubkey so agent can verify the ECDH derivation
            "client_pub_key": __import__("base64").b64encode(client_pubkey).decode(),
            "node_id": node_id,
        }
        print("Submitting job (zero-knowledge — AES key never sent)...")
        resp = requests.post(
            f"{api_url.rstrip('/')}/jobs",
            json=job_post,
            headers=headers,
        )
        if resp.status_code not in (200, 201, 202):
            print(f"Failed to submit job: {resp.status_code} {resp.text}")
            sys.exit(1)
        job_submit = resp.json()
        # Backend generates its own job_id (ignores client-provided one)
        job_id = job_submit.get("job_id", job_id)
        print(f"Job submitted. Polling for result... (job_id: {job_id})")

        # ── Step 8: Poll for result ────────────────────────────────────
        status_url = f"{api_url.rstrip('/')}/jobs/{job_id}/status"
        start = time.time()
        while True:
            try:
                r = requests.get(status_url, headers=headers, timeout=10)
                if r.status_code == 200:
                    sj = r.json()
                    if sj.get("status") == "done":
                        result_url = sj.get("result_url") or result_url
                        break
                    elif sj.get("status") == "error":
                        print(f"Job error: {sj.get('error')}")
                        sys.exit(1)
            except Exception:
                pass
            time.sleep(2)
            if time.time() - start > timeout:
                print("Timeout waiting for job result")
                sys.exit(1)

        # ── Step 9: Download and verify integrity receipt ──────────────
        receipt_url = result_url + ".receipt"
        try:
            rr = requests.get(receipt_url, timeout=30)
            if rr.status_code == 200:
                receipt_enc = rr.content
                receipt_plain = decrypt_payload(receipt_enc, final_key)
                receipt = json.loads(receipt_plain)
                print(f"Integrity receipt: input_sha256={receipt.get('input_hash','?')}")
                print(f"                   output_sha256={receipt.get('output_hash','?')}")
            else:
                print("Integrity receipt not yet available")
                receipt = None
        except Exception as e:
            print(f"Integrity receipt download failed: {e}")
            receipt = None

        # ── Step 10: Download and decrypt result ───────────────────────
        print(f"Downloading result from {result_url}")
        r = requests.get(result_url, timeout=60)
        r.raise_for_status()

        enc = r.content
        try:
            verify_encrypted_size(enc)
            print("Result size matches valid tier — plausible deniability preserved")
        except ValueError as e:
            print(f"WARNING: {e}")

        plain = decrypt_payload(enc, final_key)
        out_zip = Path.cwd() / f"{root.name}.result.zip"
        out_zip.write_bytes(plain)
        print(f"Result saved to {out_zip}")

        # ── Step 11: Verify output integrity ──────────────────────────
        if receipt:
            actual_output_hash = __import__("hashlib").sha256(plain).hexdigest()
            expected_output_hash = receipt.get("output_hash", "")
            if actual_output_hash == expected_output_hash:
                print("Output integrity verified ✓")
            else:
                print(f"OUTPUT INTEGRITY MISMATCH! expected={expected_output_hash} actual={actual_output_hash}")
