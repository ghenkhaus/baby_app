#!/bin/bash
#
# One-time TLS setup for the target host: issues a real Let's Encrypt cert for
# your domain using the DNS-01 challenge via Route53.
#
# The host never needs to be reachable from the internet. certbot proves domain
# ownership by writing a TXT record into your Route53 hosted zone, so only
# outbound access to Let's Encrypt + AWS is required.
#
# Config is read from .env (see .env.example): PI_HOST, PI_USER, DOMAIN,
# CERTBOT_EMAIL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY. PI_HOST / PI_USER may
# also be passed as positional args.
#
# Prerequisites (see CLAUDE.md "TLS Certificates"):
#   - An AWS IAM user with the Route53 policy from the docs.
#   - Your domain's authoritative DNS hosted in Route53.
#
# Usage:
#   bash setup-certs.sh [pi-host] [pi-user]
#
set -e

# Load config (PI_HOST, PI_USER, DOMAIN, CERTBOT_EMAIL, AWS_*) from .env if present.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a; . "$SCRIPT_DIR/.env"; set +a
fi

PI_HOST="${1:-${PI_HOST:-}}"
PI_USER="${2:-${PI_USER:-}}"
: "${PI_HOST:?Set PI_HOST in .env or pass it as the first argument}"
: "${PI_USER:?Set PI_USER in .env or pass it as the second argument}"
: "${DOMAIN:?Set DOMAIN in .env (e.g. registry.example.com)}"
: "${CERTBOT_EMAIL:?Set CERTBOT_EMAIL in .env}"
EMAIL="$CERTBOT_EMAIL"

if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
  echo "ERROR: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set." >&2
  echo "       These are the keys for the Route53-only IAM user." >&2
  exit 1
fi

echo "==> Setting up Let's Encrypt (DNS-01 / Route53) for $DOMAIN on $PI_USER@$PI_HOST"

ssh "$PI_USER@$PI_HOST" \
  AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" \
  AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" \
  DOMAIN="$DOMAIN" EMAIL="$EMAIL" \
  bash -s << 'REMOTE'
set -e

# certbot + the Route53 DNS plugin. The snap package bundles the plugin reliably
# across Debian versions; apt's python3-certbot-dns-route53 also works on recent
# Raspberry Pi OS. We use apt here to avoid a snapd dependency.
if ! command -v certbot &> /dev/null; then
  echo "Installing certbot + Route53 plugin..."
  sudo apt-get update
  sudo apt-get install -y certbot python3-certbot-dns-route53
fi

# Store the Route53 credentials where certbot's renewal timer (runs as root)
# can read them. Lock down permissions — these keys can edit DNS.
sudo mkdir -p /root/.aws
sudo tee /root/.aws/credentials > /dev/null << CREDS
[default]
aws_access_key_id = ${AWS_ACCESS_KEY_ID}
aws_secret_access_key = ${AWS_SECRET_ACCESS_KEY}
CREDS
sudo chmod 600 /root/.aws/credentials

echo "Requesting certificate for $DOMAIN via DNS-01..."
sudo certbot certonly \
  --dns-route53 \
  --non-interactive \
  --agree-tos \
  --email "$EMAIL" \
  --domain "$DOMAIN" \
  --keep-until-expiring

echo ""
echo "Certificate installed at:"
echo "  /etc/letsencrypt/live/$DOMAIN/fullchain.pem"
echo "  /etc/letsencrypt/live/$DOMAIN/privkey.pem"

# certbot installs a systemd timer (certbot.timer) on install that runs
# `certbot renew` twice daily. Make sure it's enabled and reload nginx on renew.
sudo systemctl enable --now certbot.timer 2>/dev/null || true
sudo mkdir -p /etc/letsencrypt/renewal-hooks/deploy
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh > /dev/null << 'HOOK'
#!/bin/bash
systemctl reload nginx
HOOK
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

echo ""
echo "Auto-renewal is active (certbot.timer). Verify with:"
echo "  sudo certbot renew --dry-run"
REMOTE

echo ""
echo "==> Cert issued. Next: render the nginx config (task nginx:config),"
echo "    install it on the host, and reload nginx:"
echo "      sudo systemctl reload nginx"
