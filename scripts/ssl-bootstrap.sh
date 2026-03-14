#!/bin/sh
# scripts/ssl-bootstrap.sh
# One-time SSL certificate bootstrap for K21 on a new VPS.
#
# Problem: Nginx cannot start without SSL certificates.
#          Certbot cannot get certificates without Nginx serving port 80.
#
# Solution (two-phase):
#   Phase 1: Start Nginx with HTTP-only bootstrap config → Certbot issues cert
#   Phase 2: Switch to full HTTPS config → Nginx restarts with SSL
#
# Prerequisites:
#   - Docker + Docker Compose v2 installed on VPS
#   - DNS A record for $DOMAIN pointing to this VPS IP
#   - Port 80 and 443 open in VPS firewall
#   - .env file written at /opt/k21/.env with DOMAIN and LETSENCRYPT_EMAIL set
#   - Repository cloned to /opt/k21/
#
# Usage (run from /opt/k21 on the VPS):
#   DOMAIN=yourdomain.com EMAIL=admin@yourdomain.com sh scripts/ssl-bootstrap.sh

set -e

DOMAIN="${DOMAIN:?DOMAIN environment variable required}"
EMAIL="${EMAIL:?EMAIL environment variable required}"
REPO_DIR="${REPO_DIR:-/opt/k21}"

echo "=== K21 SSL Bootstrap ==="
echo "Domain: $DOMAIN"
echo "Email:  $EMAIL"
echo ""

# Step 1: Replace ${DOMAIN} placeholder in nginx.conf with actual domain
echo "Step 1: Substituting domain in nginx/nginx.conf..."
sed -i "s/\${DOMAIN}/$DOMAIN/g" "$REPO_DIR/nginx/nginx.conf"
echo "  Done."

# Step 2: Start Nginx with HTTP-only bootstrap config
echo "Step 2: Starting Nginx in bootstrap mode (HTTP only)..."
cp "$REPO_DIR/nginx/nginx.conf" "$REPO_DIR/nginx/nginx.conf.bak"
cp "$REPO_DIR/nginx/nginx-bootstrap.conf" "$REPO_DIR/nginx/nginx.conf"

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d nginx
sleep 5

echo "  Nginx started. Verifying port 80 is serving..."
curl -sf "http://$DOMAIN/health" > /dev/null || {
  echo "  ERROR: Port 80 not reachable. Check DNS and firewall."
  exit 1
}
echo "  Port 80 OK."

# Step 3: Obtain certificate via certbot
echo "Step 3: Requesting Let's Encrypt certificate..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm certbot \
  certonly --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  --non-interactive

echo "  Certificate issued."

# Step 4: Restore full HTTPS nginx config
echo "Step 4: Switching to HTTPS config..."
cp "$REPO_DIR/nginx/nginx.conf.bak" "$REPO_DIR/nginx/nginx.conf"
rm -f "$REPO_DIR/nginx/nginx.conf.bak"

# Step 5: Start the full prod stack
echo "Step 5: Starting full production stack..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

echo ""
echo "=== Bootstrap complete ==="
echo "Verify HTTPS: curl -I https://$DOMAIN"
echo "Verify redirect: curl -I http://$DOMAIN"
echo ""
echo "Certificate renewal is automatic via the certbot container."
echo "Certbot checks for renewal every 12 hours."

# NOTE: After each certificate renewal, Nginx must reload to pick up new cert files.
# The certbot container does NOT automatically signal Nginx to reload.
# Add a cron job on the VPS to reload Nginx after renewal:
#   0 3 * * * docker compose -f /opt/k21/docker-compose.yml -f /opt/k21/docker-compose.prod.yml exec nginx nginx -s reload
# Or use the JonasAlfredsson/docker-nginx-certbot image which handles this automatically.
