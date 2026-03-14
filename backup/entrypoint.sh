#!/bin/sh
# backup/entrypoint.sh
# Runs at container startup. Sets up rclone config, installs cron job, and starts crond.
set -e

echo "[$(date -Iseconds)] Backup container starting..."

# Step 1: Validate required env vars
: "${B2_KEY_ID:?B2_KEY_ID is required}"
: "${B2_APPLICATION_KEY:?B2_APPLICATION_KEY is required}"
: "${B2_BUCKET:?B2_BUCKET is required}"
: "${DATABASE_URL:?DATABASE_URL is required}"
: "${GPG_PASSPHRASE:?GPG_PASSPHRASE is required}"

# Step 2: Write rclone config from environment variables
# Config is written to /root/.config/rclone/rclone.conf at runtime
# The image contains rclone.conf.template but NOT real credentials
mkdir -p /root/.config/rclone
cat > /root/.config/rclone/rclone.conf << EOF
[b2]
type = b2
account = ${B2_KEY_ID}
key = ${B2_APPLICATION_KEY}
EOF
echo "[$(date -Iseconds)] rclone config written."

# Step 3: Create log file for cron output
LOGFILE=/var/log/backup.log
touch "$LOGFILE"

# Step 4: Write cron job (02:00 UTC daily)
# Env vars must be explicitly passed — crond does not inherit shell env
cat > /etc/cron.d/k21-backup << EOF
DATABASE_URL=${DATABASE_URL}
GPG_PASSPHRASE=${GPG_PASSPHRASE}
B2_KEY_ID=${B2_KEY_ID}
B2_APPLICATION_KEY=${B2_APPLICATION_KEY}
B2_BUCKET=${B2_BUCKET}
0 2 * * * root /backup/backup.sh >> ${LOGFILE} 2>&1
EOF
chmod 0644 /etc/cron.d/k21-backup
echo "[$(date -Iseconds)] Cron job installed (02:00 UTC daily)."

# Step 5: Run backup once at startup in background if BACKUP_ON_STARTUP=1
if [ "${BACKUP_ON_STARTUP:-0}" = "1" ]; then
  echo "[$(date -Iseconds)] BACKUP_ON_STARTUP=1 — running backup now..."
  /backup/backup.sh >> "$LOGFILE" 2>&1 &
fi

echo "[$(date -Iseconds)] Backup container ready. Next run: 02:00 UTC."

# Step 6: Start crond and tail log (keeps container alive and logs visible)
crond -f -l 8 &
exec tail -f "$LOGFILE"
