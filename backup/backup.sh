#!/bin/sh
# backup/backup.sh
# Full backup: pg_dump → gzip → GPG encrypt → rclone upload → delete old backups
# Runs at 02:00 UTC daily via cron in the backup container.
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILENAME="k21_${TIMESTAMP}.sql.gz.gpg"
BACKUP_FILE="/tmp/${BACKUP_FILENAME}"

echo "[$(date -Iseconds)] Starting backup: $BACKUP_FILENAME"

# Validate required env vars
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${GPG_PASSPHRASE:?GPG_PASSPHRASE is required}"
: "${B2_BUCKET:?B2_BUCKET is required}"

# Step 1: Dump, compress, and encrypt in a single pipeline
# pg_dump streams to gzip → gpg writes encrypted file
# Uses DATABASE_URL which points to pgbouncer (NOT postgres directly)
pg_dump "$DATABASE_URL" \
  | gzip \
  | gpg --batch --yes \
        --passphrase "$GPG_PASSPHRASE" \
        --symmetric \
        --cipher-algo AES256 \
        -o "$BACKUP_FILE"

FILE_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date -Iseconds)] Backup created: $BACKUP_FILE ($FILE_SIZE)"

# Step 2: Upload to Backblaze B2
rclone copy "$BACKUP_FILE" "b2:${B2_BUCKET}/backups/"
echo "[$(date -Iseconds)] Uploaded to b2:${B2_BUCKET}/backups/${BACKUP_FILENAME}"

# Step 3: Delete backups older than 7 days from B2 (INFRA-07)
# --min-age 7d deletes files OLDER than 7 days
rclone delete "b2:${B2_BUCKET}/backups/" --min-age 7d
echo "[$(date -Iseconds)] Cleaned up backups older than 7 days"

# Step 4: Remove local temp file
rm -f "$BACKUP_FILE"

echo "[$(date -Iseconds)] Backup complete."
