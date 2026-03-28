#!/bin/bash
# ============================================================================
# K21 Database Restore Script — untuk VPS
# Restore backup .sql.gz ke PostgreSQL container
# ============================================================================
# Usage: bash scripts/db-restore.sh backups/k21_backup_XXXXXXXX_XXXXXX.sql.gz
# ============================================================================

set -e

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: bash scripts/db-restore.sh <backup-file.sql.gz>"
  echo "Example: bash scripts/db-restore.sh backups/k21_backup_20260328_120000.sql.gz"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ File tidak ditemukan: $BACKUP_FILE"
  exit 1
fi

# Config
DB_USER="${DB_USER:-appuser}"
DB_NAME="${DB_NAME:-k21}"
CONTAINER="${DB_CONTAINER:-k21-postgres-1}"

echo "=== K21 Database Restore ==="
echo "File:      $BACKUP_FILE"
echo "Target:    $DB_USER@$CONTAINER/$DB_NAME"
echo ""

# Check container is running
if ! docker ps --format '{{.Names}}' | grep -q "$CONTAINER"; then
  echo "❌ Container $CONTAINER tidak berjalan. Jalankan docker compose up -d postgres dulu."
  exit 1
fi

echo "⚠️  PERINGATAN: Ini akan menimpa semua data di database $DB_NAME!"
read -p "Lanjutkan? (y/N): " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Dibatalkan."
  exit 0
fi

echo ""
echo "Restoring..."

# Decompress and pipe to psql inside container
gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" --quiet 2>&1 | tail -5

echo ""
echo "✅ Restore selesai."
echo ""
echo "Jalankan migration terbaru jika belum:"
echo "  node apps/api/run-migration-0019.mjs"
echo "  node apps/api/run-migration-0020.mjs"
