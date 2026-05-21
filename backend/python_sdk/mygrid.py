#!/usr/bin/env python3
"""mygrid CLI - minimal SDK for packing, encrypting, uploading jobs and polling results."""
import argparse
import base64
import json
import os
import sys
import tempfile
import time
import zipfile
from pathlib import Path

import requests
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from tqdm import tqdm

CONFIG_PATH = Path.home() / ".mygrid" / "config.json"


def ensure_config_dir():
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)


def save_config(data):
    ensure_config_dir()
    CONFIG_PATH.write_text(json.dumps(data))


def load_config():
    if not CONFIG_PATH.exists():
        return {}
    return json.loads(CONFIG_PATH.read_text())


def cmd_init(args):
    cfg = load_config()
    if args.api_url:
        cfg["api_url"] = args.api_url
    if args.api_key:
        cfg["api_key"] = args.api_key
    save_config(cfg)
    print("Saved config to", CONFIG_PATH)


def zip_path(path: Path, out_path: Path):
    with zipfile.ZipFile(out_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        if path.is_file():
            zf.write(path, arcname=path.name)
        else:
            for p in path.rglob("*"):
                if p.is_file():
                    zf.write(p, arcname=str(p.relative_to(path)))


def encrypt_file(in_file: Path, out_file: Path, key: bytes):
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    data = in_file.read_bytes()
    ct = aesgcm.encrypt(nonce, data, None)
    out_file.write_bytes(nonce + ct)


def upload_with_progress(url: str, file_path: Path):
    total = file_path.stat().st_size
    with open(file_path, "rb") as f:
        with tqdm(total=total, unit="B", unit_scale=True, desc="upload") as p:
            def gen():
                while True:
                    chunk = f.read(64 * 1024)
                    if not chunk:
                        break
                    p.update(len(chunk))
                    yield chunk
            resp = requests.put(url, data=gen())
    resp.raise_for_status()
    return resp


def cmd_run(args):
    cfg = load_config()
    api_url = args.api_url or cfg.get("api_url")
    if not api_url:
        print("No API URL configured. Run 'mygrid init --api-url <url>' first.")
        sys.exit(1)

    path = Path(args.path).resolve()
    if not path.exists():
        print("Path not found:", path)
        sys.exit(1)

    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        zip_path_obj = td / "job.zip"
        enc_path = td / "job.zip.enc"

        print("Zipping...")
        zip_path(path, zip_path_obj)

        key = os.urandom(32)
        key_b64 = base64.b64encode(key).decode()
        print("Encrypting payload...")
        encrypt_file(zip_path_obj, enc_path, key)

        # Get presigned URLs
        presign_url = f"{api_url.rstrip('/')}/presign"
        filename = path.name
        print("Requesting presigned URLs from", presign_url)
        try:
            r = requests.post(presign_url, json={"filename": filename}, timeout=10)
            r.raise_for_status()
            pres = r.json()
            upload_url = pres["upload_url"]
            result_url = pres.get("result_url")
            job_id = pres.get("job_id")
        except Exception as e:
            print("Failed to get presigned URLs from matchmaker:", e)
            print("You can provide --upload-url and --result-upload-url instead.")
            if not args.upload_url:
                sys.exit(1)
            upload_url = args.upload_url
            result_url = args.result_upload_url
            job_id = None

        print("Uploading encrypted payload...")
        upload_with_progress(upload_url, enc_path)

        # Create job
        job_post = {"encrypted_job_link": upload_url, "enc_key_b64": key_b64}
        print("Registering job with matchmaker")
        resp = requests.post(f"{api_url.rstrip('/')}/jobs", json=job_post)
        if resp.status_code not in (200, 202):
            print("Failed to create job:", resp.status_code, resp.text)
            sys.exit(1)
        print("Job queued; polling for result...")

        # If job_id wasn't provided by presign, try to read from response
        if not job_id:
            try:
                job_id = resp.json().get("job_id")
            except Exception:
                job_id = None

        # Polling loop
        status_url = f"{api_url.rstrip('/')}/jobs/{job_id}/status" if job_id else None
        start = time.time()
        while True:
            if status_url:
                try:
                    r = requests.get(status_url, timeout=10)
                    if r.status_code == 200:
                        sj = r.json()
                        if sj.get("status") == "done":
                            result_url = sj.get("result_url")
                            break
                        elif sj.get("status") == "error":
                            print("Job error:", sj.get("error"))
                            sys.exit(1)
                except Exception:
                    pass
            # fallback: sleep and wait
            time.sleep(2)
            if time.time() - start > (args.timeout or 600):
                print("Timeout waiting for job result")
                sys.exit(1)

        print("Result available at:", result_url)
        # Download result
        print("Downloading result...")
        r = requests.get(result_url, timeout=60)
        r.raise_for_status()
        enc_result = r.content

        # Decrypt
        aesgcm = AESGCM(key)
        nonce = enc_result[:12]
        ct = enc_result[12:]
        plain = aesgcm.decrypt(nonce, ct, None)

        out_zip = Path.cwd() / f"{filename}.result.zip"
        out_zip.write_bytes(plain)
        print("Wrote result to", out_zip)


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd")

    init = sub.add_parser("init")
    init.add_argument("--api-url")
    init.add_argument("--api-key")

    runp = sub.add_parser("run")
    runp.add_argument("path")
    runp.add_argument("--api-url")
    runp.add_argument("--upload-url")
    runp.add_argument("--result-upload-url")
    runp.add_argument("--timeout", type=int, default=600)

    args = p.parse_args()
    if args.cmd == "init":
        cmd_init(args)
    elif args.cmd == "run":
        cmd_run(args)
    else:
        p.print_help()


if __name__ == "__main__":
    main()
