#!/bin/sh
# C-08: Auto-generate PgBouncer userlist.txt from environment variables
# This runs at container startup before PgBouncer starts

set -e

PGBOUNCER_USER="${POSTGRES_USER:-appuser}"
PGBOUNCER_PASS="${POSTGRES_PASSWORD}"

if [ -z "$PGBOUNCER_PASS" ]; then
  echo "[pgbouncer-entrypoint] ERROR: POSTGRES_PASSWORD not set — cannot generate userlist"
  exit 1
fi

MD5_HASH=$(echo -n "${PGBOUNCER_PASS}${PGBOUNCER_USER}" | md5sum | awk '{print "md5"$1}')

echo "\"${PGBOUNCER_USER}\" \"${MD5_HASH}\"" > /etc/pgbouncer/userlist.txt
echo "[pgbouncer-entrypoint] userlist.txt generated for user ${PGBOUNCER_USER}"

exec pgbouncer /etc/pgbouncer/pgbouncer.ini
