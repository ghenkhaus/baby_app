#!/bin/bash
set -e

# Load deployment config (PI_HOST, PI_USER, ...) from .env if present.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a; . "$SCRIPT_DIR/.env"; set +a
fi

# Target host/user come from CLI args, else .env. Both are required.
PI_HOST="${1:-${PI_HOST:-}}"
PI_USER="${2:-${PI_USER:-}}"
: "${PI_HOST:?Set PI_HOST in .env or pass it as the first argument}"
: "${PI_USER:?Set PI_USER in .env or pass it as the second argument}"
APP_DIR="/home/$PI_USER/baby-registry"

echo "==> Deploying to $PI_USER@$PI_HOST:$APP_DIR"

# Build frontend (skip if dist/ already up to date — pass --skip-build to skip)
if [ "$3" != "--skip-build" ]; then
  echo "==> Building frontend..."
  npx vite build
fi

# Create tarball of what we need (no node_modules, include the db)
echo "==> Packaging..."
REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
tar czf /tmp/baby-registry-deploy.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='registry.db' \
  --exclude='registry.db-wal' \
  --exclude='registry.db-shm' \
  -C "$(dirname "$REPO_DIR")" "$(basename "$REPO_DIR")"

# Copy to Pi
echo "==> Copying to Pi..."
scp /tmp/baby-registry-deploy.tar.gz "$PI_USER@$PI_HOST:/tmp/"

# Set up on Pi
echo "==> Setting up on Pi..."
ssh "$PI_USER@$PI_HOST" bash -s "$APP_DIR" << 'REMOTE'
APP_DIR="$1"
set -e

# Install Node.js if needed
if ! command -v node &> /dev/null; then
  echo "Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "Node version: $(node -v)"
echo "npm version: $(npm -v)"

# Preserve existing database (timestamped backup in home dir)
# Must stop server first so WAL is checkpointed into the main DB file
BACKUP=""
if [ -f "$APP_DIR/registry.db" ]; then
  echo "Stopping server to flush database..."
  pkill -f 'server/index.ts' 2>/dev/null || true
  sleep 2
  BACKUP="$HOME/registry.db.deploy-backup-$(date +%Y%m%d-%H%M%S)"
  echo "Backing up existing database to $BACKUP..."
  cp "$APP_DIR/registry.db" "$BACKUP"
  # Also copy WAL/SHM if they still exist
  [ -f "$APP_DIR/registry.db-wal" ] && cp "$APP_DIR/registry.db-wal" "$BACKUP-wal"
  [ -f "$APP_DIR/registry.db-shm" ] && cp "$APP_DIR/registry.db-shm" "$BACKUP-shm"
fi

# Extract app
rm -rf "$APP_DIR"
mkdir -p "$(dirname $APP_DIR)"
tar xzf /tmp/baby-registry-deploy.tar.gz -C "$(dirname $APP_DIR)"
# tar extracts as baby_app, rename to target
if [ -d "$(dirname $APP_DIR)/baby_app" ] && [ "$(dirname $APP_DIR)/baby_app" != "$APP_DIR" ]; then
  mv "$(dirname $APP_DIR)/baby_app" "$APP_DIR"
fi
rm -f /tmp/baby-registry-deploy.tar.gz

# Restore database from backup if it existed
if [ -n "$BACKUP" ] && [ -f "$BACKUP" ]; then
  echo "Restoring existing database from $BACKUP..."
  cp "$BACKUP" "$APP_DIR/registry.db"
  [ -f "$BACKUP-wal" ] && cp "$BACKUP-wal" "$APP_DIR/registry.db-wal"
  [ -f "$BACKUP-shm" ] && cp "$BACKUP-shm" "$APP_DIR/registry.db-shm"
fi

cd "$APP_DIR"

# Install dependencies
echo "Installing dependencies..."
npm_config_cache=/tmp/npm-cache npm install --legacy-peer-deps 2>&1 | tail -5

# Try systemd service (requires sudo), fall back to nohup
if sudo -n true 2>/dev/null; then
  echo "Creating systemd service..."
  sudo tee /etc/systemd/system/baby-registry.service > /dev/null << EOF
[Unit]
Description=Baby Registry Tracker
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
ExecStart=$(which node) --import tsx/esm $APP_DIR/server/index.ts
Restart=always
RestartSec=5
Environment=PORT=3001
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

  sudo systemctl daemon-reload
  sudo systemctl enable baby-registry
  sudo systemctl restart baby-registry
  sleep 2
  sudo systemctl status baby-registry --no-pager || true
else
  echo "No passwordless sudo — restarting via process management..."
  pkill -f 'server/index.ts' 2>/dev/null || true
  sleep 1
  cd "$APP_DIR"
  nohup $(which npx) tsx server/index.ts > /tmp/baby-registry.log 2>&1 &
  SERVER_PID=$!
  # tsx boot + migrations can take 10s+ on the Pi — poll instead of a fixed sleep
  for i in $(seq 1 15); do
    if curl -s http://localhost:3001/api/categories > /dev/null 2>&1; then
      echo "Server is running (PID: $SERVER_PID)"
      break
    fi
    if [ "$i" = "15" ]; then
      echo "WARNING: Server not responding after 30s. Check /tmp/baby-registry.log"
    fi
    sleep 2
  done
fi

echo ""
echo "==> Done! Baby Registry is running at:"
echo "    http://$(hostname -I | awk '{print $1}'):3001"
echo ""
echo "    Manage with: sudo systemctl {start|stop|restart|status} baby-registry"
echo "    View logs:   journalctl -u baby-registry -f"
REMOTE

echo ""
echo "==> Deploy complete! Access your registry at:"
echo "    http://$PI_HOST:3001"
