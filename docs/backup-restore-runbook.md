# K21 Backup & Restore Runbook

## Overview

Backups run daily at 02:00 UTC via the backup Docker container.
Format: `k21_YYYYMMDD_HHMMSS.sql.gz.gpg`
Storage: Backblaze B2 bucket, path: `backups/`
Retention: 7 days (older files are automatically deleted)
Encryption: GPG symmetric AES256

## CRITICAL: GPG Passphrase

The `GPG_PASSPHRASE` is the **only** way to decrypt backups. If it is lost:
- All B2 backups become permanently unrestorable
- The only recovery is from a secondary source (manual export, if any)

**The GPG_PASSPHRASE must be stored in ALL of these locations:**
1. GitHub Actions secret: `GPG_PASSPHRASE` (used by automated backup)
2. Password manager (Bitwarden, 1Password, etc.) — under "K21 Infrastructure"
3. Encrypted USB drive stored offline — labelled "K21 GPG Backup Key"

**Verify the offline copy exists before marking Phase 0 complete.**

---

## Restore Procedure

### Prerequisites
- Access to the VPS or a machine with `rclone`, `gpg`, and `psql` installed
- `GPG_PASSPHRASE` — the encryption passphrase
- `B2_KEY_ID` and `B2_APPLICATION_KEY` — Backblaze credentials
- `DATABASE_URL` — connection string for the target database
- The target database must exist (empty or to be replaced)

### Step 1: Identify the backup to restore

```bash
# Configure rclone for B2
rclone lsd b2:k21-backups/backups/
# Lists all available backup files with timestamps
```

Choose the most recent backup before the data loss event.

### Step 2: Download and verify the backup

```bash
# Download backup
rclone copy b2:k21-backups/backups/k21_YYYYMMDD_HHMMSS.sql.gz.gpg /tmp/

# Verify file is not corrupted (should print file info)
gpg --batch --passphrase "$GPG_PASSPHRASE" \
    --list-packets /tmp/k21_YYYYMMDD_HHMMSS.sql.gz.gpg
```

### Step 3: Restore using the restore script

```bash
cd /opt/k21

DATABASE_URL="postgres://appuser:PASSWORD@pgbouncer:5432/k21" \
GPG_PASSPHRASE="your-passphrase" \
B2_KEY_ID="your-key-id" \
B2_APPLICATION_KEY="your-app-key" \
B2_BUCKET="k21-backups" \
sh backup/restore.sh k21_YYYYMMDD_HHMMSS.sql.gz.gpg
```

### Step 4: Verify restore

```bash
# Connect to DB and verify row counts
psql "$DATABASE_URL" -c "\dt"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
```

### Step 5: Restart application

```bash
cd /opt/k21
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart api web
```

---

## Manual Backup Trigger

To trigger an immediate backup (outside of the 02:00 UTC schedule):

```bash
# On the VPS, exec into the backup container and run backup.sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  exec backup /backup/backup.sh
```

Or start the container with `BACKUP_ON_STARTUP=1`:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  up -d backup -e BACKUP_ON_STARTUP=1
```

---

## Phase 0 Restore Drill

Before Phase 0 is marked complete, perform this drill on the VPS:

1. [x] Trigger a manual backup: `docker exec k21-backup-1 /backup/backup.sh`
2. [x] Verify the file appears in B2: `rclone ls b2:k21-backups/backups/`
3. [x] Download the backup file
4. [x] Decrypt with GPG and verify it gunzips to valid SQL
5. [x] Run `restore.sh` against a test database (not production)
6. [x] Verify the restored database has the expected tables/rows
7. [x] Document the drill result and date in this runbook

**Drill result:** All 6 restore steps completed successfully — database restored to test instance with correct tables and rows
**Drill date:** 2026-03-15
**Performed by:** Aditya
