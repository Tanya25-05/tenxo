#!/usr/bin/env python3
"""Minimal Edge Agent daemon.

Listens for job messages on NATS, downloads encrypted payload from Cloudflare R2 (S3),
decrypts with AES-GCM, runs the provided `run.py` inside a GPU-enabled Docker container,
captures logs/output, encrypts them, uploads back to R2, and notifies via NATS.

Environment variables (required):
- NATS_URL (e.g. nats://your-nats:4222)
- NATS_SUBJECT (default: jobs)
- R2_ENDPOINT (e.g. https://<accountid>.r2.cloudflarestorage.com)
- R2_REGION (optional, for boto3)
- R2_ACCESS_KEY_ID
- R2_SECRET_ACCESS_KEY
- R2_BUCKET
- AES_KEY (base64-encoded 32 bytes key for AES-256-GCM)

Job message JSON (example):
{
  "object_key": "jobs/job123.tar.gz.enc",
  "nonce": "base64-nonce-12bytes",
  "callback": "jobs.results",
  "result_key": "results/job123.out.enc",
  "job_id": "job123"
}
"""

import asyncio
import base64
import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import boto3
from botocore.config import Config
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from nats.aio.client import Client as NATS

LOG = logging.getLogger("edge_agent")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def get_env(name, default=None, required=False):
    v = os.getenv(name, default)
    if required and not v:
        LOG.error("Missing required env %s", name)
        sys.exit(2)
    return v


def make_s3_client(endpoint, access_key, secret_key, region=None):
    cfg = Config(signature_version="s3v4")
    session = boto3.session.Session()
    return session.client(
        "s3",
        region_name=region,
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=cfg,
    )


def aes_decrypt(key: bytes, nonce_b64: str, data: bytes) -> bytes:
    nonce = base64.b64decode(nonce_b64)
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, data, None)


def aes_encrypt(key: bytes, data: bytes) -> (str, bytes):
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ct = aesgcm.encrypt(nonce, data, None)
    return base64.b64encode(nonce).decode(), ct


async def handle_job(msg, s3, bucket, aes_key: bytes, work_root: Path, nc: NATS):
    try:
        payload = json.loads(msg.data.decode())
    except Exception:
        LOG.exception("invalid job payload")
        return

    obj = payload.get("object_key")
    nonce_b64 = payload.get("nonce")
    callback = payload.get("callback")
    result_key = payload.get("result_key")
    job_id = payload.get("job_id", "unknown")

    if not obj or not nonce_b64 or not callback or not result_key:
        LOG.error("job message missing fields: %s", payload)
        return

    LOG.info("Claiming job %s -> %s", job_id, obj)

    workdir = work_root / job_id
    if workdir.exists():
        shutil.rmtree(workdir)
    workdir.mkdir(parents=True)

    enc_path = workdir / "payload.enc"
    try:
        with open(enc_path, "wb") as fh:
            s3.download_fileobj(bucket, obj, fh)
    except Exception:
        LOG.exception("failed to download %s", obj)
        return

    try:
        with open(enc_path, "rb") as fh:
            enc = fh.read()
        tar_data = aes_decrypt(aes_key, nonce_b64, enc)
    except Exception:
        LOG.exception("decryption failed for %s", obj)
        return

    tar_path = workdir / "payload.tar.gz"
    tar_path.write_bytes(tar_data)

    # extract tar.gz
    try:
        subprocess.run(["tar", "-xzf", str(tar_path), "-C", str(workdir)], check=True)
    except subprocess.CalledProcessError:
        LOG.exception("failed to extract payload")
        return

    # run Docker
    LOG.info("Running docker job for %s", job_id)
    try:
        proc = subprocess.run(
            [
                "docker",
                "run",
                "--gpus",
                "all",
                "--rm",
                "-v",
                f"{workdir}:/workspace",
                "python:3.9",
                "python",
                "/workspace/run.py",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=60 * 60,
            check=False,
        )
        output = proc.stdout or b""
        rc = proc.returncode
    except Exception:
        LOG.exception("docker execution failed")
        output = b""
        rc = 253

    # bundle logs + any outputs (e.g., weights)
    out_tar = workdir / "result.tar.gz"
    try:
        # collect files: logs and workspace
        logs_file = workdir / "run.log"
        logs_file.write_bytes(output)
        subprocess.run(["tar", "-czf", str(out_tar), "-C", str(workdir), "."], check=True)
    except Exception:
        LOG.exception("failed to create result tar")
        return

    # encrypt result and upload
    try:
        import io

        data = out_tar.read_bytes()
        res_nonce_b64, ct = aes_encrypt(aes_key, data)
        s3.upload_fileobj(io.BytesIO(ct), bucket, result_key)
    except Exception:
        LOG.exception("failed to upload result to %s", result_key)
        return

    # notify callback
    try:
        resp = {
            "job_id": job_id,
            "status": "done" if rc == 0 else "failed",
            "return_code": rc,
            "result_key": result_key,
            "nonce": res_nonce_b64,
        }
        await nc.publish(callback, json.dumps(resp).encode())
        LOG.info("Notified callback %s for job %s", callback, job_id)
    except Exception:
        LOG.exception("failed to publish callback for %s", job_id)


async def run():
    nats_url = get_env("NATS_URL", "nats://localhost:4222", required=True)
    subject = get_env("NATS_SUBJECT", "jobs")
    r2_endpoint = get_env("R2_ENDPOINT", required=True)
    r2_region = get_env("R2_REGION", None)
    r2_key = get_env("R2_ACCESS_KEY_ID", required=True)
    r2_secret = get_env("R2_SECRET_ACCESS_KEY", required=True)
    bucket = get_env("R2_BUCKET", required=True)
    aes_key_b64 = get_env("AES_KEY", required=True)

    aes_key = base64.b64decode(aes_key_b64)

    s3 = make_s3_client(r2_endpoint, r2_key, r2_secret, region=r2_region)

    nc = NATS()
    await nc.connect(servers=[nats_url])
    LOG.info("Connected to NATS %s, subscribing to %s", nats_url, subject)

    work_root = Path(get_env("JOB_WORKDIR", "/tmp/job"))
    work_root.mkdir(parents=True, exist_ok=True)

    async def cb(msg):
        await handle_job(msg, s3, bucket, aes_key, work_root, nc)

    await nc.subscribe(subject, cb=cb)

    # keep running
    while True:
        await asyncio.sleep(1)


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        LOG.info("shutting down")
