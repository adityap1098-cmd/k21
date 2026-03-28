#!/bin/bash
# ============================================================================
# K21 Database Backup Script
# Jalankan di PC lokal untuk membuat backup yang bisa di-restore di VPS
# ============================================================================
# Usage: bash scripts/db-backup.sh
# Output: backups/k21_backup_YYYYMMDD_HHMMSS.sql.gz
# ============================================================================

set -e

# Config — sesuaikan jika berbeda
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5433}"
DB_USER="${DB_USER:-appuser}"
DB_NAME="${DB_NAME:-k21}"
DB_PASSWORD="${DB_PASSWORD:-k21devpass}"

# Output
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$(dirname "$0")/../backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/k21_backup_${TIMESTAMP}.sql"

echo "=== K21 Database Backup ==="
echo "Source: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
echo ""

# Full dump: schema + data, custom format untuk kompresi
export PGPASSWORD="$DB_PASSWORD"
pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  -F p \
  -f "$BACKUP_FILE"

# Compress
gzip "$BACKUP_FILE"
FINAL_FILE="${BACKUP_FILE}.gz"

SIZE=$(du -h "$FINAL_FILE" | cut -f1)
echo ""
echo "✅ Backup selesai: $FINAL_FILE ($SIZE)"
echo ""
echo "=== Cara restore di VPS ==="
echo "1. Copy file ke VPS:"
echo "   scp $FINAL_FILE user@vps-ip:/opt/k21/backups/"
echo ""
echo "2. Restore di VPS:"
echo "   docker exec -i k21-postgres-1 bash -c 'gunzip -c /backups/$(basename $FINAL_FILE) | psql -U appuser -d k21'"
echo "   Atau:"
echo "   bash scripts/db-restore.sh backups/$(basename $FINAL_FILE)"
