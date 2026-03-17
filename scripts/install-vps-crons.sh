#!/bin/bash
# install-vps-crons.sh — Installs VPS host cron jobs for k21
#
# Purpose: The certbot container has no docker CLI, so it cannot reload nginx
# after renewing the certificate. This script installs a host cron job that
# reloads nginx at 03:00 and 15:00 — after certbot's 12h renewal windows
# (~02:00 and ~14:00).
#
# Usage: bash scripts/install-vps-crons.sh
# Idempotent: running multiple times overwrites the same file with no side effects.
# Requires: root privileges (writes to /etc/cron.d/)

set -e

K21_DIR="${K21_DIR:-/opt/k21}"

cat > /etc/cron.d/k21-nginx-reload << EOF
# Reload nginx after certbot renews the certificate
# Must run AFTER certbot's 12h renewal loop (certbot runs renewal ~02:00 and ~14:00)
0 3 * * * root docker compose -f ${K21_DIR}/docker-compose.yml -f ${K21_DIR}/docker-compose.prod.yml exec -T nginx nginx -s reload >> /var/log/k21-nginx-reload.log 2>&1
0 15 * * * root docker compose -f ${K21_DIR}/docker-compose.yml -f ${K21_DIR}/docker-compose.prod.yml exec -T nginx nginx -s reload >> /var/log/k21-nginx-reload.log 2>&1
EOF

chmod 644 /etc/cron.d/k21-nginx-reload
echo "Nginx reload cron installed at /etc/cron.d/k21-nginx-reload"
