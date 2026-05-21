# mygrid Python SDK

Minimal CLI for AI developers to upload encrypted jobs and poll results.

Install dependencies:

```bash
python -m pip install -r python_sdk/requirements.txt
```

Quickstart:

```bash
python python_sdk/mygrid.py init --api-url http://<MATCHMAKER_HOST>:8080
python python_sdk/mygrid.py run ./train_script_folder
```

Notes:

- This CLI expects the matchmaker to expose a `/presign` endpoint that returns JSON `{upload_url, result_url, job_id?}` and a job status endpoint at `/jobs/{job_id}/status`. If those are not implemented, provide `--upload-url` and `--result-upload-url` to `run`.
- The payload is encrypted with AES-256-GCM; the agent must use the same key to decrypt.
