#!/bin/sh
# scripts/verify-log-rotation.sh
# Verifies that Docker log rotation is active on all running K21 containers.
# Run on the VPS after deployment: sh scripts/verify-log-rotation.sh
#
# Expected output for each container:
#   PASS: <container-name> — json-file max-size=10m max-file=5
# Fail if any container shows a different log driver or missing options.

set -e

FAIL=0
EXPECTED_MAX_SIZE="10m"
EXPECTED_MAX_FILE="5"

echo "=== K21 Log Rotation Verification ==="
echo ""

# Get all running K21 containers (those with k21 in name)
CONTAINERS=$(docker ps --format '{{.Names}}' | grep -i k21 || true)

if [ -z "$CONTAINERS" ]; then
  echo "WARNING: No K21 containers are running. Start the stack first."
  echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d"
  exit 1
fi

for CONTAINER in $CONTAINERS; do
  # Get log driver type
  LOG_DRIVER=$(docker inspect "$CONTAINER" \
    --format '{{.HostConfig.LogConfig.Type}}' 2>/dev/null || echo "unknown")

  # Get log options
  MAX_SIZE=$(docker inspect "$CONTAINER" \
    --format '{{index .HostConfig.LogConfig.Config "max-size"}}' 2>/dev/null || echo "none")

  MAX_FILE=$(docker inspect "$CONTAINER" \
    --format '{{index .HostConfig.LogConfig.Config "max-file"}}' 2>/dev/null || echo "none")

  if [ "$LOG_DRIVER" = "json-file" ] && \
     [ "$MAX_SIZE" = "$EXPECTED_MAX_SIZE" ] && \
     [ "$MAX_FILE" = "$EXPECTED_MAX_FILE" ]; then
    echo "PASS: $CONTAINER — $LOG_DRIVER max-size=${MAX_SIZE} max-file=${MAX_FILE}"
  else
    echo "FAIL: $CONTAINER — driver=${LOG_DRIVER} max-size=${MAX_SIZE} max-file=${MAX_FILE}"
    FAIL=1
  fi
done

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "=== ALL CONTAINERS HAVE CORRECT LOG ROTATION ==="
else
  echo "=== SOME CONTAINERS HAVE INCORRECT LOG ROTATION ==="
  echo "Fix: Recreate containers with 'docker compose up -d --force-recreate'"
  exit 1
fi
