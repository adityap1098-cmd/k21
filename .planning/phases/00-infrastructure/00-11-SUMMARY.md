---
phase: 00-infrastructure
plan: 11
subsystem: infra
tags: [nginx, certbot, ssl, cron, backup, restore, disaster-recovery]

# Dependency graph
requires:
  - phase: 00-infrastructure/00-09
    provides: backup restore script and runbook with placeholder drill fields
  - phase: 00-infrastructure/00-10
    provides: Phase 0 smoke-test sign-off, identified two remaining gaps
provides:
  - Host cron job that reloads Nginx after certbot certificate renewal (closes INFRA-01 gap)
  - Completed Phase 0 restore drill record in backup-restore-runbook.md (closes sign-off gap)
affects: [01-core-domain, deploy-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Host cron /etc/cron.d/k21-nginx-reload handles post-certbot nginx reload (container has no docker CLI)
    - install-vps-crons.sh is idempotent — called on every deploy to ensure cron is always present

key-files:
  created:
    - scripts/install-vps-crons.sh
  modified:
    - docker-compose.prod.yml
    - .github/workflows/ci-cd.yml
    - docs/backup-restore-runbook.md

key-decisions:
  - "Nginx reload cron runs at 03:00 and 15:00 via /etc/cron.d/k21-nginx-reload — after certbot's 02:00 and 14:00 renewal windows"
  - "docker compose exec -T flag required for non-interactive cron context to prevent TTY hang"
  - "install-vps-crons.sh called on every deploy (idempotent) — ensures cron survives VPS reprovisioning"
  - "Phase 0 restore drill documented: 2026-03-15, performed by Aditya, all 6 restore steps succeeded"

patterns-established:
  - "Idempotent VPS provisioning scripts: scripts/install-vps-crons.sh pattern for host-level setup"
  - "Human-action checkpoint pattern: operator updates docs + commits, resumes with signal word"

requirements-completed: [INFRA-01, INFRA-06, INFRA-07]

# Metrics
duration: multi-session (checkpoint)
completed: 2026-03-17
---

# Phase 0 Plan 11: Gap Closure — Nginx Reload Cron and Restore Drill Summary

**Host cron provisioning script closes the INFRA-01 nginx-reload gap, and the Phase 0 restore drill is documented with actual date (2026-03-15), operator (Aditya), and successful outcome**

## Performance

- **Duration:** Multi-session (checkpoint:human-action between tasks)
- **Started:** 2026-03-17
- **Completed:** 2026-03-17
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `scripts/install-vps-crons.sh` — idempotent script that writes `/etc/cron.d/k21-nginx-reload` with two daily entries (03:00 and 15:00) reloading Nginx after certbot's renewal windows
- Added `install-vps-crons.sh` call to the CI/CD deploy step so the cron is reprovisioned on every deployment
- Added explanatory comment to `docker-compose.prod.yml` above the certbot service documenting the reload architecture
- Recorded completed Phase 0 restore drill in `docs/backup-restore-runbook.md` with all 7 checklist items checked, date 2026-03-15, performed by Aditya, all 6 restore steps successful

## Task Commits

Each task was committed atomically:

1. **Task 1: Provision nginx reload cron via install-vps-crons.sh** - `162d091` (feat)
2. **Task 2: Record the Phase 0 restore drill result** - `abf3868` (docs)

## Files Created/Modified

- `scripts/install-vps-crons.sh` - Idempotent script installing /etc/cron.d/k21-nginx-reload; uses K21_DIR env var, sets 644 permissions
- `docker-compose.prod.yml` - Added comment above certbot service explaining why host cron is needed for nginx reload
- `.github/workflows/ci-cd.yml` - Deploy step now calls install-vps-crons.sh after docker compose up (Step 3.5)
- `docs/backup-restore-runbook.md` - Drill record completed: all [x] checked, date 2026-03-15, operator Aditya, result successful

## Decisions Made

- **-T flag on docker compose exec:** Required for cron context — disables pseudo-TTY allocation which would cause exec to hang when run from crond (no controlling terminal)
- **Cron times 03:00 and 15:00:** Chosen to run after certbot's 12h renewal windows (~02:00 and ~14:00), ensuring the new certificate is always loaded promptly
- **Idempotent deploy hook:** install-vps-crons.sh is called on every deploy rather than once at provisioning — ensures cron survives VPS wipes, OS reinstalls, or accidental /etc/cron.d cleanup

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Task 2 was a `checkpoint:human-action` by design — the operator updated the runbook and resumed with "drill documented".

## User Setup Required

None — `install-vps-crons.sh` is called automatically on every deploy via CI/CD. No manual steps required beyond the one-time drill documentation that was completed.

## Next Phase Readiness

- Phase 0 is fully complete: all infrastructure gaps closed, all requirements satisfied
- INFRA-01 (SSL auto-renewal end-to-end) is now fully closed: cert renews AND nginx reloads
- INFRA-06 (backup/restore) and INFRA-07 (disaster recovery drill) both documented and verified
- Ready to begin Phase 1 (Core Domain)

---
*Phase: 00-infrastructure*
*Completed: 2026-03-17*

## Self-Check: PASSED

- FOUND: scripts/install-vps-crons.sh
- FOUND: docs/backup-restore-runbook.md
- FOUND: .planning/phases/00-infrastructure/00-11-SUMMARY.md
- FOUND: commit 162d091 (feat: provision nginx reload cron)
- FOUND: commit abf3868 (docs: record Phase 0 restore drill result)
