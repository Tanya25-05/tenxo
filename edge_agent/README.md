# Edge Agent (Rust)

Minimal Edge Agent that:

- Subscribes to NATS `jobs` subject
- Downloads an encrypted job payload from a presigned URL
- Decrypts with AES-256-GCM (12-byte nonce prefix)
- Writes `run.py` to a temp workspace
- Runs `docker run --gpus all --rm -v /tmp/...:/workspace python:3.9 python /workspace/run.py`
- Encrypts combined stdout/stderr and uploads to a presigned `result_upload_url`
- Publishes a JSON result to `jobs.results`

Environment variables:

- `NATS_URL` (default: `nats://127.0.0.1:4222`)
- `JOBS_SUBJECT` (default: `jobs`)
- `RESULT_SUBJECT` (default: `jobs.results`)
- `JOB_DECRYPT_KEY_B64` (base64-encoded 32-byte AES key) — used if job doesn't include `enc_key_b64`

Job message JSON (sent to `jobs`):

```json
{
  "job_id": "123",
  "encrypted_job_url": "<presigned GET URL>",
  "result_upload_url": "<presigned PUT URL>",
  "enc_key_b64": "<optional base64 key>"
}
```

Build & run:

```bash
cd edge_agent
cargo build --release
JOB_DECRYPT_KEY_B64=<base64-32-byte-key> NATS_URL="nats://x.x.x.x:4222" ./target/release/edge_agent
```

Notes:

- The encrypted payload must be AES-256-GCM where the first 12 bytes are the nonce, followed by ciphertext.
- For MVP use presigned URLs for R2 objects to avoid complex S3 auth code here.

# Edge Agent (Provider)

Minimal daemon to run on a GPU-enabled provider (RunPod). It:

- Subscribes to NATS `jobs` subject
- Downloads encrypted job payload from Cloudflare R2 (S3-compatible)
- Decrypts with AES-256-GCM (shared key)
- Runs `docker run --gpus all --rm -v /tmp/job/<id>:/workspace python:3.9 python /workspace/run.py`
- Packages logs/output, encrypts, uploads results back to R2, and notifies via NATS

Usage (on the provider instance):

1. Create a Python venv and install deps:

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

2. Set environment variables (example):

```bash
export NATS_URL=nats://<matchmaker>:4222
export NATS_SUBJECT=jobs
export R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
export R2_ACCESS_KEY_ID=...
export R2_SECRET_ACCESS_KEY=...
export R2_BUCKET=your-bucket
export AES_KEY=$(python -c "import os,base64; print(base64.b64encode(os.urandom(32)).decode())")
```

3. Run the agent:

```bash
python agent.py
```

Testing: send a job message from your matchmaker with the fields listed in the top of `agent.py`.
