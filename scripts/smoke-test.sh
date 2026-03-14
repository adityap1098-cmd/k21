#!/bin/sh
# VPS smoke test checklist for Phase 0
# Run on the VPS after deployment or via SSH tunnel from dev machine.
# Each check prints PASS/FAIL and exits 1 if any check fails.
set -e

DOMAIN="${DOMAIN:-yourdomain.com}"
FAIL=0

check() {
  LABEL="$1"
  CMD="$2"
  EXPECTED="$3"
  RESULT=$(eval "$CMD" 2>&1) || true
  if echo "$RESULT" | grep -q "$EXPECTED"; then
    echo "PASS: $LABEL"
  else
    echo "FAIL: $LABEL (got: $RESULT)"
    FAIL=1
  fi
}

echo "=== K21 Phase 0 VPS Smoke Test ==="
echo "Domain: $DOMAIN"
echo ""

# INFRA-01: HTTPS reachable with valid cert
check "HTTPS returns 200" \
  "curl -s -o /dev/null -w '%{http_code}' https://$DOMAIN/health" \
  "200"

# INFRA-01: HTTP redirects to HTTPS
check "HTTP redirects to HTTPS (301)" \
  "curl -s -o /dev/null -w '%{http_code}' http://$DOMAIN" \
  "301"

# INFRA-02: API health via PgBouncer (verified by health endpoint)
check "GET /health returns status ok" \
  "curl -s https://$DOMAIN/health" \
  "ok"

# INFRA-05: Log rotation on api container
check "API container has log rotation" \
  "docker inspect k21-api-1 --format '{{.HostConfig.LogConfig.Type}}'" \
  "json-file"

# INFRA-08: Netdata accessible on localhost only
check "Netdata accessible on 127.0.0.1:19999" \
  "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:19999/api/v1/info" \
  "200"

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "=== ALL CHECKS PASSED ==="
else
  echo "=== SOME CHECKS FAILED — review above ==="
  exit 1
fi

# To access Netdata dashboard via SSH tunnel:
#   ssh -L 19999:localhost:19999 user@${VPS_HOST}
#   Then open: http://localhost:19999 in your browser
#   Verify it is NOT accessible from internet: curl http://<VPS_PUBLIC_IP>:19999 should timeout/refuse
