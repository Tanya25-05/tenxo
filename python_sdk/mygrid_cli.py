#!/usr/bin/env python3
"""Simple mygrid CLI: presign -> upload -> submit
Usage: python mygrid_cli.py --api-url http://localhost:8080 --api-key KEY --path ./jobdir
"""
import argparse
import requests
import tempfile
import zipfile
import os
import sys
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def zip_dir(path):
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.zip')
    tmp.close()
    with zipfile.ZipFile(tmp.name, 'w', zipfile.ZIP_DEFLATED) as zf:
        if os.path.isdir(path):
            for root, dirs, files in os.walk(path):
                for f in files:
                    full = os.path.join(root, f)
                    arc = os.path.relpath(full, start=path)
                    zf.write(full, arc)
        else:
            zf.write(path, os.path.basename(path))
    return tmp.name


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--api-url', required=True)
    p.add_argument('--api-key', required=True)
    p.add_argument('--path', required=True)
    args = p.parse_args()

    api_url = args.api_url.rstrip('/')
    headers = {'X-API-Key': args.api_key}

    print('Zipping', args.path)
    zip_path = zip_dir(args.path)

    key = AESGCM.generate_key(bit_length=256)
    key_b64 = base64.b64encode(key).decode()
    enc_path = tempfile.NamedTemporaryFile(delete=False, suffix='.enc')
    enc_path.close()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    with open(zip_path, 'rb') as f_in, open(enc_path.name, 'wb') as f_out:
        plaintext = f_in.read()
        ciphertext = aesgcm.encrypt(nonce, plaintext, None)
        f_out.write(nonce + ciphertext)

    print('Requesting presign...')
    r = requests.post(f'{api_url}/presign', headers=headers, json={'enc_key_b64': key_b64})
    if r.status_code != 200:
        print('presign failed', r.status_code, r.text)
        sys.exit(1)
    js = r.json()
    upload_url = js['upload_url']
    job_id = js['job_id']
    print('Uploading encrypted payload to', upload_url)
    with open(enc_path.name, 'rb') as fh:
        r2 = requests.put(upload_url, data=fh)
    if r2.status_code not in (200,201,204):
        print('upload failed', r2.status_code, r2.text)
        sys.exit(1)
    print('Submitting job', job_id)
    payload = {'job_id': job_id, 'encrypted_job_link': upload_url, 'enc_key_b64': key_b64}
    r3 = requests.post(f'{api_url}/jobs', json=payload, headers=headers)
    if r3.status_code not in (200,201,202):
        print('job submit failed', r3.status_code, r3.text)
        sys.exit(1)
    print('Submitted. Job ID:', job_id)
    print('You can monitor via WebSocket at ws://localhost:8080/ws?token=...')


if __name__ == '__main__':
    main()
