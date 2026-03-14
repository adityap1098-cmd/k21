---
plan: "00-09"
phase: "00-infrastructure"
status: complete
completed: 2026-03-15
commits:
  - hash: "5de7268"
    message: "feat(00-09): add interactive backup restore script"
  - hash: "367b4cf"
    message: "docs(00-09): add disaster recovery runbook with GPG offline storage requirements and Phase 0 drill checklist"
---

# Plan 00-09: Backup Restore Script + Runbook

## What Was Built

Two files that complete the backup system — a backup that has never been restored is not a backup.

## Key Files Created

- `backup/restore.sh` — Interactive restore script: lists B2 backups, downloads chosen file, decrypts with GPG, restores to PostgreSQL
- `docs/backup-restore-runbook.md` — Disaster recovery runbook with offline GPG passphrase storage requirements and Phase 0 drill checklist

## Implementation Details

**backup/restore.sh:**
- Validates 5 required env vars (`DATABASE_URL`, `GPG_PASSPHRASE`, `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET`)
- Configures rclone at runtime (no config file needed)
- Lists available backups from B2 before prompting
- Accepts optional filename arg or prompts interactively
- Requires explicit `yes` confirmation before overwriting database
- Restore pipeline: `gpg --decrypt | gunzip | psql` (reverse of backup.sh)
- Atomic .env temp file cleanup after restore

**docs/backup-restore-runbook.md:**
- GPG passphrase must exist in 3 offline locations (GitHub secret + password manager + encrypted USB)
- 5-step restore procedure with exact commands
- Manual backup trigger instructions (`BACKUP_ON_STARTUP=1`)
- Phase 0 drill checklist (7 items to check off before Phase 0 sign-off)

## Verification

- ✓ `bash -n backup/restore.sh` exits 0 (syntax valid)
- ✓ `docs/backup-restore-runbook.md` exists
- ✓ GPG_PASSPHRASE from env var (not hardcoded)
- ✓ Offline storage requirement documented (3 locations)
- ✓ Phase 0 Restore Drill section present

## Self-Check: PASSED
