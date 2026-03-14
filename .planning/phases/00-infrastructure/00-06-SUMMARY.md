---
phase: 00-infrastructure
plan: "06"
subsystem: infra
tags: [backup, gpg, rclone, backblaze-b2, postgresql, alpine, docker, cron]

# Dependency graph
requires:
  - phase: 00-03
    provides: docker-compose backup service stub (build context ./backup)
  - phase: 00-02
    provides: .env.example with B2_KEY_ID, B2_APPLICATION_KEY, GPG_PASSPHRASE entries
  - phase: 00-01
    provides: backup/test-backup.sh GPG round-trip test script

provides:
  - Alpine 3.19 backup container with postgresql16-client, gnupg, dcron, rclone
  - backup.sh: pg_dump | gzip | gpg AES256 | rclone copy pipeline
  - entrypoint.sh: runtime rclone config injection + 02:00 UTC cron setup
  - rclone.conf.template: placeholder template (no real credentials in image)
  - 7-day retention via rclone delete --min-age 7d (INFRA-07)

affects:
  - 00-infrastructure (phase completion — backup was last hard requirement)
  - ops runbooks (backup restore procedure references these scripts)

# Tech tracking
tech-stack:
  added:
    - rclone (Backblaze B2 cloud storage sync)
    - gnupg / GPG symmetric AES256 encryption
    - postgresql16-client (pg_dump binary)
    - dcron (Alpine cron daemon)
  patterns:
    - Runtime config injection: credentials written to disk at container startup, never baked into image
    - Pipeline backup: pg_dump | gzip | gpg in single shell pipe (no temp unencrypted files)
    - Env var validation at startup with :? syntax (fail-fast)
    - Explicit env passthrough to cron (crond does not inherit shell env)

key-files:
  created:
    - backup/Dockerfile
    - backup/backup.sh
    - backup/entrypoint.sh
    - backup/rclone.conf.template
  modified: []

key-decisions:
  - "GPG symmetric AES256 chosen over asymmetric — simpler key management for single-VPS, passphrase from env var"
  - "rclone config written at runtime from env vars — no credentials ever stored in image or template"
  - "Cron env vars explicitly written to /etc/cron.d/k21-backup — crond does not inherit parent shell environment"
  - "BACKUP_ON_STARTUP=1 flag added for operator-triggered immediate backups during Phase 0 testing"
  - "pg_dump targets DATABASE_URL (pgbouncer) not postgres directly — consistent with prepared-statements-disabled policy"

patterns-established:
  - "Runtime secret injection: write config files from env vars in entrypoint, never ship secrets in image"
  - "Single-pipeline backup: pipe pg_dump → gzip → gpg without writing unencrypted intermediates to disk"
  - "Fail-fast env validation: :? syntax at container startup before any work begins"

requirements-completed: [INFRA-06, INFRA-07]

# Metrics
duration: 7min
completed: 2026-03-15
---

# Phase 00 Plan 06: Backup Container Summary

**Alpine 3.19 backup container with pg_dump | gzip | gpg AES256 | rclone B2 pipeline, 7-day retention, and runtime credential injection via entrypoint**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-15T01:18:13Z
- **Completed:** 2026-03-15T01:19:40Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Backup pipeline: single-pass pg_dump | gzip | gpg AES256 with no unencrypted temp files
- 7-day B2 retention via `rclone delete --min-age 7d` (satisfies INFRA-07)
- Runtime rclone config injection: credentials written at container startup, never in image
- GPG round-trip test (`backup/test-backup.sh`) passes: encrypt/decrypt verified

## Task Commits

Each task was committed atomically:

1. **Task 1: Backup container Dockerfile and backup script** - `a509ff2` (feat)
2. **Task 2: Container entrypoint with cron setup and rclone config injection** - `8ac8b1e` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `backup/Dockerfile` - Alpine 3.19 with postgresql16-client, gnupg, dcron, rclone; sets ENTRYPOINT
- `backup/backup.sh` - pg_dump | gzip | gpg AES256 | rclone copy + 7-day retention delete
- `backup/entrypoint.sh` - Validates env vars, writes rclone.conf at runtime, installs cron, starts crond
- `backup/rclone.conf.template` - B2 config template with placeholder values (never real credentials)

## Decisions Made
- GPG symmetric AES256 over asymmetric: simpler passphrase management for single-VPS operation
- `rclone.conf` written at container startup from env vars — no credentials in image or template
- Cron job at `/etc/cron.d/k21-backup` with explicit env var passthrough (crond does not inherit shell env)
- `BACKUP_ON_STARTUP=1` escape hatch for Phase 0 testing without waiting for 02:00 UTC

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None at this stage — backup container requires `B2_KEY_ID`, `B2_APPLICATION_KEY`, `GPG_PASSPHRASE`, and `DATABASE_URL` to be set in the environment. These are already documented in `.env.example` from Plan 00-02.

Operators must:
1. Create a Backblaze B2 bucket named `k21-backups`
2. Create a B2 application key with read/write access to that bucket
3. Set the 5 required env vars before starting the backup container

## Next Phase Readiness
- All 4 backup container files are in place; `docker-compose up backup` will build and start the container
- `backup/test-backup.sh` passes GPG round-trip: ready for CI
- Phase 00 infrastructure requirements INFRA-06 and INFRA-07 satisfied
- Phase 0 can now be declared complete pending final integration testing

---
*Phase: 00-infrastructure*
*Completed: 2026-03-15*
