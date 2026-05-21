Provider Install Script

Usage:

Run on the provider machine (Ubuntu/HiveOS):

```bash
curl -sSL https://yourgrid.com/install.sh | sudo bash
```

What it does:

- Detects OS (Ubuntu/HiveOS)
- Installs Docker
- Attempts to install NVIDIA drivers (may require manual steps on some hosts)
- Installs `nvidia-container-toolkit`
- Downloads the prebuilt `mygrid-agent` binary to `/usr/local/bin/mygrid-agent`
- Prompts for payout wallet and NATS URL
- Writes `/etc/mygrid/agent.env` and creates a systemd service `/etc/systemd/system/mygrid-agent.service`
- Enables and starts the service

Notes:

- Replace the `AGENT_URL` inside the script with your actual release binary URL before publishing.
- GPU driver installation can fail on some cloud images; test on your target provider images and adapt as needed.
