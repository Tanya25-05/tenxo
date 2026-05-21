#!/usr/bin/env bash
set -euo pipefail

# install-wsl.sh
# Full WSL2 helper to update the system and install Redis, NATS (JetStream), and Go.
# Run this from your WSL distro shell (e.g., Ubuntu) as a normal user. It will use sudo when needed.

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
NATS_CONF="$PROJECT_ROOT/configs/nats.conf"
GO_VERSION="1.22.2"
NATS_VERSION="2.10.14"

echo "1/6: Updating system packages..."
sudo apt update && sudo apt upgrade -y

echo "2/6: Installing required packages (redis-server, curl, wget, tar, ca-certificates)..."
sudo apt install -y redis-server curl wget tar ca-certificates

echo "3/6: Starting Redis server..."
sudo service redis-server start || (echo "Failed to start redis via service; try 'redis-server' manually" && true)

echo "4/6: Installing nats-server (if missing)..."
if ! command -v nats-server >/dev/null 2>&1; then
  tmpdir=$(mktemp -d)
  pushd "$tmpdir"
  echo "Downloading nats-server v${NATS_VERSION}..."
  curl -sSLO "https://github.com/nats-io/nats-server/releases/download/v${NATS_VERSION}/nats-server-v${NATS_VERSION}-linux-amd64.tar.gz"
  tar xzf "nats-server-v${NATS_VERSION}-linux-amd64.tar.gz"
  sudo cp "nats-server-v${NATS_VERSION}-linux-amd64/nats-server" /usr/local/bin/
  sudo chmod +x /usr/local/bin/nats-server
  popd
  rm -rf "$tmpdir"
  echo "nats-server installed to /usr/local/bin/nats-server"
else
  echo "nats-server already installed: $(nats-server --version 2>/dev/null | head -n1 || echo '(unknown)')"
fi

echo "5/6: Starting nats-server with JetStream enabled..."
if pgrep -x nats-server >/dev/null 2>&1; then
  echo "nats-server already running"
else
  if [ -f "$NATS_CONF" ]; then
    nohup nats-server -c "$NATS_CONF" -js > /var/log/nats-server.log 2>&1 &
  else
    nohup nats-server -js > /var/log/nats-server.log 2>&1 &
  fi
  sleep 1
  echo "nats-server started (logs: /var/log/nats-server.log)"
fi

echo "6/6: Installing Go if needed (target: ${GO_VERSION})..."
need_go_install=0
if command -v go >/dev/null 2>&1; then
  have_go=$(go version | awk '{print $3}' | sed 's/go//')
  echo "Found go version: $have_go"
  if [ "$have_go" != "$GO_VERSION" ]; then
    echo "Go version differs from target; will install ${GO_VERSION}"
    need_go_install=1
  fi
else
  echo "Go not found; will install ${GO_VERSION}"
  need_go_install=1
fi

if [ "$need_go_install" -eq 1 ]; then
  tmpdir=$(mktemp -d)
  pushd "$tmpdir"
  echo "Downloading go${GO_VERSION}..."
  wget -q "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz"
  sudo rm -rf /usr/local/go
  sudo tar -C /usr/local -xzf "go${GO_VERSION}.linux-amd64.tar.gz"
  popd
  rm -rf "$tmpdir"

  # Persist PATH for future shells
  if ! grep -q '/usr/local/go/bin' "$HOME/.profile" 2>/dev/null; then
    echo 'export PATH=$PATH:/usr/local/go/bin' >> "$HOME/.profile"
  fi
  export PATH=$PATH:/usr/local/go/bin
  echo "Go ${GO_VERSION} installed. Run 'source ~/.profile' or open a new shell to pick up PATH."
fi

echo
echo "Verification summary:"
echo -n "go: "; command -v go >/dev/null 2>&1 && go version || echo "(not installed)"
echo -n "nats-server: "; command -v nats-server >/dev/null 2>&1 && nats-server --version | head -n1 || echo "(not installed)"
echo -n "redis: "; redis-cli ping >/dev/null 2>&1 && echo "PONG" || echo "(redis not responding)"

echo
echo "Done. To continue:"
echo "- Open a new shell or run: source ~/.profile"
echo "- Run the Go API from the project root inside WSL:"
echo "  cd $PROJECT_ROOT && go run main.go"

echo "If you want the script to also install the WSL distro, run the Windows command:"
echo "  wsl --install -d ubuntu-22.04"
