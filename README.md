# GPU Grid Matchmaker

This repository now separates frontend and backend. See `/frontend` for the Next.js scaffold and `/backend` for the Go matchmaker and supporting services.

A lightweight control plane for decentralized GPU compute.

## What this does

## Requirements

- WSL2 with a Linux distro installed
- Go 1.22+ inside WSL
- NATS Server with JetStream enabled
- Redis

## Quick start

1. Install a WSL2 distro on Windows:

```powershell
wsl --install -d ubuntu-22.04
```

2. Open the WSL shell and install Redis, Go, and NATS:

```bash
sudo apt update
sudo apt install -y redis-server curl tar
```

Install Go using the official tarball if not already installed.

3. Run Redis in WSL:

```bash
sudo service redis-server start
```

4. Start NATS with JetStream enabled:

```bash
cd /mnt/e/projects/GPU_grid
nats-server -c configs/nats.conf
```

5. Run the Go API:

```bash
cd /mnt/e/projects/GPU_grid
go run main.go
```

## API

### POST /jobs

Request body:

```json
{
  "encrypted_job_link": "s3://encrypted-job-blob"
}
```

Response:

```json
{
  "status": "queued",
  "subject": "jobs"
}
```

### GET /nodes

Returns active nodes from Redis:

```json
{
  "nodes": [{ "node_id": "456", "status": "idle", "ttl_seconds": 59 }]
}
```

## NATS stream configuration

`configs/nats.conf` enables JetStream persistence and stores stream data in `./jetstream`.

## Docker alternative

If you prefer Docker inside WSL, use:

```bash
docker compose up -d
```

Then run the Go API as above.
