#!/usr/bin/env bash
# Tenxo Edge Agent — one-command install for GPU providers.
# Usage: curl -fsSL https://tenxo.ai/install.sh | bash
set -euo pipefail

RELEASE_URL="https://github.com/YOUR_ORG/gpu-grid/releases/latest/download/edge_agent-linux-amd64"
BIN_DIR="/usr/local/bin"
CONFIG_DIR="/etc/tenxo"
SERVICE_NAME="tenxo-agent"

echo "============================================"
echo " Tenxo Edge Agent Installer"
echo "============================================"

# ── Prerequisites ──────────────────────────────────────────────────────────
command -v docker &>/dev/null || {
  echo "ERROR: Docker is required. Install: https://docs.docker.com/engine/install/"
  exit 1
}

# ── Download binary ────────────────────────────────────────────────────────
echo "[1/4] Downloading edge agent binary..."
sudo mkdir -p "$BIN_DIR"
sudo curl -fsSL -o "$BIN_DIR/edge_agent" "$RELEASE_URL"
sudo chmod +x "$BIN_DIR/edge_agent"
echo "       Installed $BIN_DIR/edge_agent"

# ── Create config ──────────────────────────────────────────────────────────
echo "[2/4] Configuring..."
sudo mkdir -p "$CONFIG_DIR"
if [ ! -f "$CONFIG_DIR/agent.env" ]; then
  cat << 'ENVEOF' | sudo tee "$CONFIG_DIR/agent.env" > /dev/null
# Tenxo Edge Agent Configuration
# Fill in the values from your Tenxo dashboard.

# Matchmaker connection
NATS_URL=nats://api.tenxo.ai:4222
MATCHMAKER_URL=http://api.tenxo.ai:8080

# Your account ID (shown in developer dashboard)
OWNER=

# Optional: custom node ID (defaults to hostname)
# NODE_ID=
ENVEOF
  echo "       Created $CONFIG_DIR/agent.env — EDIT THIS FILE with your settings"
else
  echo "       $CONFIG_DIR/agent.env already exists, skipping"
fi

# ── Install systemd service ────────────────────────────────────────────────
echo "[3/4] Installing systemd service..."
cat << 'UNITEOF' | sudo tee "/etc/systemd/system/$SERVICE_NAME.service" > /dev/null
[Unit]
Description=Tenxo GPU Edge Agent
Documentation=https://tenxo.ai/docs
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/tenxo/agent.env
ExecStart=/usr/local/bin/edge_agent
Restart=always
RestartSec=10
LimitNOFILE=65536

# Security hardening
NoNewPrivileges=true
ProtectSystem=full
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNITEOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"
echo "       $SERVICE_NAME service installed and started"

# ── Verify ─────────────────────────────────────────────────────────────────
echo "[4/4] Verifying..."
sleep 2
if systemctl is-active --quiet "$SERVICE_NAME"; then
  echo ""
  echo "============================================"
  echo " Tenxo Edge Agent is RUNNING"
  echo "============================================"
  echo ""
  echo "  Check status:  sudo systemctl status $SERVICE_NAME"
  echo "  View logs:     sudo journalctl -u $SERVICE_NAME -f"
  echo "  Config:        $CONFIG_DIR/agent.env"
  echo ""
  echo "  Your GPU should appear in the Tenxo dashboard"
  echo "  within 30 seconds."
else
  echo "ERROR: Service failed to start. Check: sudo journalctl -u $SERVICE_NAME -n 50"
  exit 1
fi
