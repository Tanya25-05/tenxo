#!/usr/bin/env bash
set -euo pipefail

# mygrid provider install script
# Usage: curl -sSL https://yourgrid.com/install.sh | bash
# This script detects Ubuntu/HiveOS, installs Docker + NVIDIA runtime, downloads the edge agent binary,
# prompts for payout/wallet, sets up a systemd service, and starts the agent.

AGENT_URL="https://yourgrid.com/releases/edge_agent" # replace with real binary URL
SERVICE_NAME="mygrid-agent"
BIN_PATH="/usr/local/bin/${SERVICE_NAME}"
CONF_DIR="/etc/mygrid"
CONF_FILE="${CONF_DIR}/agent.env"

echo "Detecting OS..."
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS_ID=${ID}
  OS_PRETTY=${PRETTY_NAME}
else
  echo "Cannot detect OS. Exiting."
  exit 1
fi

echo "Detected: $OS_PRETTY"

if [[ "$OS_ID" != "ubuntu" && "$OS_ID" != "hiveos" ]]; then
  echo "This script currently supports Ubuntu and HiveOS. You can still try, but proceed with caution."
fi

echo "Updating packages..."
if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get upgrade -y
else
  echo "apt-get not found. Please install Docker and dependencies manually."
fi

echo "Installing Docker..."
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com -o get-docker.sh
  sudo sh get-docker.sh
  rm get-docker.sh
  sudo usermod -aG docker "$USER" || true
else
  echo "Docker already installed"
fi

echo "Installing NVIDIA drivers and container toolkit..."
# Basic approach for Ubuntu
if command -v nvidia-smi >/dev/null 2>&1; then
  echo "NVIDIA drivers detected"
else
  echo "Attempting to install NVIDIA drivers from package repos (Ubuntu)..."
  sudo apt-get install -y --no-install-recommends nvidia-driver-535 || echo "Driver install may require manual steps"
fi

# Install nvidia-container-toolkit
if ! dpkg -s nvidia-container-toolkit >/dev/null 2>&1; then
  distribution="$(. /etc/os-release; echo $ID$VERSION_ID)"
  curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
  curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
  sudo apt-get update
  sudo apt-get install -y nvidia-container-toolkit
  sudo systemctl restart docker
else
  echo "nvidia-container-toolkit already installed"
fi

echo "Downloading edge agent binary..."
sudo mkdir -p "${CONF_DIR}"
sudo curl -fsSL "$AGENT_URL" -o "$BIN_PATH"
sudo chmod +x "$BIN_PATH"

echo "Configuring agent..."
read -p "Enter your payout wallet address (UPI / Crypto) or press Enter to skip: " WALLET
read -p "Enter NATS server URL (nats://host:4222) or press Enter to keep default: " NATS_URL_INPUT

NATS_URL=${NATS_URL_INPUT:-"nats://127.0.0.1:4222"}

sudo tee "$CONF_FILE" > /dev/null <<EOF
# mygrid agent environment
WALLET=${WALLET}
NATS_URL=${NATS_URL}
# Add other env vars as needed
EOF

echo "Creating systemd service..."
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=MyGrid Edge Agent
After=network.target docker.service

[Service]
Type=simple
EnvironmentFile=${CONF_FILE}
ExecStart=${BIN_PATH}
Restart=on-failure
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now ${SERVICE_NAME}.service || true

echo "Installation complete. Service status:"
sudo systemctl status ${SERVICE_NAME}.service --no-pager || true

echo "If you changed your user groups for Docker, log out and back in or reboot for changes to take effect."
