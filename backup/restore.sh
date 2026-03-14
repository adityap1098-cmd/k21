#!/bin/sh
# backup/restore.sh
# Interactive restore from Backblaze B2.
# Run on the VPS (or locally with rclone + postgres client installed).
#
# Usage:
#   DATABASE_URL=... GPG_PASSPHRASE=... B2_KEY_ID=... B2_APPLICATION_KEY=... B2_BUCKET=... \
#   sh backup/restore.sh [backup-filename]
#
# If backup-filename is not provided, lists available backups and prompts.
# WARNING: This REPLACES the current database. Use only for disaster recovery.
set -e

# Validate required env vars
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${GPG_PASSPHRASE:?GPG_PASSPHRASE is required}"
: "${B2_KEY_ID:?B2_KEY_ID is required}"
: "${B2_APPLICATION_KEY:?B2_APPLICATION_KEY is required}"
: "${B2_BUCKET:?B2_BUCKET is required}"

echo "=== K21 Backup Restore ==="
echo "WARNING: This will REPLACE the current database contents."
echo ""

# Configure rclone for this session
mkdir -p /tmp/rclone-restore
cat > /tmp/rclone-restore/rclone.conf << EOF
[b2]
type = b2
account = ${B2_KEY_ID}
key = ${B2_APPLICATION_KEY}
EOF

RCLONE="rclone --config /tmp/rclone-restore/rclone.conf"

# List available backups
echo "Available backups in b2:${B2_BUCKET}/backups/:"
$RCLONE ls "b2:${B2_BUCKET}/backups/" | sort -k2 || {
  echo "ERROR: Cannot list B2 bucket. Check B2 credentials."
  exit 1
}
echo ""

# Select backup file
BACKUP_FILENAME="$1"
if [ -z "$BACKUP_FILENAME" ]; then
  printf "Enter backup filename to restore (e.g., k21_20260314_020001.sql.gz.gpg): "
  read -r BACKUP_FILENAME
fi

if [ -z "$BACKUP_FILENAME" ]; then
  echo "ERROR: No backup file selected."
  exit 1
fi

# Download backup
LOCAL_BACKUP="/tmp/${BACKUP_FILENAME}"
echo "Downloading: b2:${B2_BUCKET}/backups/${BACKUP_FILENAME}..."
$RCLONE copy "b2:${B2_BUCKET}/backups/${BACKUP_FILENAME}" /tmp/
echo "Downloaded to: $LOCAL_BACKUP"

if [ ! -f "$LOCAL_BACKUP" ]; then
  echo "ERROR: Download failed — file not found at $LOCAL_BACKUP"
  exit 1
fi

# Confirm before restore
printf "Restore %s to DATABASE_URL? [yes/NO]: " "$BACKUP_FILENAME"
read -r CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled."
  rm -f "$LOCAL_BACKUP"
  exit 0
fi

# Decrypt and restore pipeline:
# gpg --decrypt → gunzip → psql
echo "Restoring... (this may take a few minutes)"
gpg --batch --yes \
    --passphrase "$GPG_PASSPHRASE" \
    --decrypt "$LOCAL_BACKUP" \
  | gunzip \
  | psql "$DATABASE_URL"

echo ""
echo "Restore complete."
echo "Verify row counts manually: psql $DATABASE_URL -c '\dt'"

# Cleanup
rm -f "$LOCAL_BACKUP"
rm -rf /tmp/rclone-restore
echo "Temporary files cleaned up."
