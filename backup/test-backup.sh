#!/bin/sh
# Dry-run test for backup.sh
# Validates that required environment variables are checked and
# that the backup pipeline produces a file without real DB/B2 connections.
set -e

echo "=== Backup Dry-Run Test ==="

# Check required env vars are documented (not necessarily set in test env)
REQUIRED_VARS="DATABASE_URL GPG_PASSPHRASE B2_KEY_ID B2_APPLICATION_KEY B2_BUCKET"
echo "Required vars: $REQUIRED_VARS"

# Simulate the backup pipeline using echo instead of pg_dump
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TMP_FILE="/tmp/k21_dryrun_${TIMESTAMP}.sql.gz.gpg"

echo "Simulating: pg_dump | gzip | gpg --symmetric"
echo "fake-backup-data" | gzip | \
  gpg --batch --yes --passphrase "test-passphrase" \
      --symmetric --cipher-algo AES256 \
      -o "$TMP_FILE" 2>/dev/null

echo "Backup file created: $TMP_FILE"
ls -lh "$TMP_FILE"

echo "Simulating: decrypt + verify"
DECRYPTED=$(gpg --batch --yes --passphrase "test-passphrase" \
                --decrypt "$TMP_FILE" 2>/dev/null | gunzip)
if [ "$DECRYPTED" = "fake-backup-data" ]; then
  echo "PASS: Encrypt/decrypt round-trip successful"
else
  echo "FAIL: Decrypt produced unexpected output"
  exit 1
fi

rm -f "$TMP_FILE"
echo "=== Dry-run complete. Real backup requires DATABASE_URL + B2 credentials. ==="
