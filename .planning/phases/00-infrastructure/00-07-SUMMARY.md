---
phase: 00-infrastructure
plan: "07"
subsystem: infra
tags: [netdata, monitoring, log-rotation, docker, security]

# Dependency graph
requires:
  - phase: 00-03
    provides: docker-compose.prod.yml with netdata service and log rotation config on all services

provides:
  - netdata/netdata.conf binding Netdata web UI to 127.0.0.1:19999 (localhost-only)
  - scripts/verify-log-rotation.sh for post-deployment verification of container log rotation
  - SSH tunnel instructions documented in scripts/smoke-test.sh

affects:
  - deployment — must mount netdata.conf volume correctly when standing up production stack
  - operations — verify-log-rotation.sh runs on VPS after each deployment

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Security-by-config: bind Netdata to 127.0.0.1 to prevent internet exposure when using network_mode: host"
    - "Verification scripts: shell scripts that inspect running containers via docker inspect"

key-files:
  created:
    - netdata/netdata.conf
    - scripts/verify-log-rotation.sh
  modified:
    - docker-compose.prod.yml
    - scripts/smoke-test.sh

key-decisions:
  - "Netdata netdata.conf mounted as read-only bind mount over netdataconfig named volume — ensures config survives volume recreation and is tracked in git"
  - "verify-log-rotation.sh uses docker inspect to check live container config, not compose files — verifies what is actually running, not what is defined"

patterns-established:
  - "All monitoring access via SSH tunnel: Netdata bound to 127.0.0.1, accessed via ssh -L 19999:localhost:19999"
  - "Verification scripts in scripts/ directory runnable directly on VPS with sh"

requirements-completed:
  - INFRA-05
  - INFRA-08

# Metrics
duration: 2min
completed: 2026-03-14
---

# Phase 00 Plan 07: Monitoring Config and Log Rotation Verification Summary

**Netdata web UI locked to 127.0.0.1:19999 via bind-mount config, with shell verification script for container log rotation (json-file, max-size=10m, max-file=5)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-14T18:18:19Z
- **Completed:** 2026-03-14T18:20:12Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `netdata/netdata.conf` with `[web] bind to = 127.0.0.1` preventing internet exposure on network_mode: host
- Updated `docker-compose.prod.yml` to mount netdata.conf as read-only bind mount alongside the named volume
- Created `scripts/verify-log-rotation.sh` to verify all running k21 containers have json-file logging with max-size=10m/max-file=5
- Added SSH tunnel instructions to `scripts/smoke-test.sh` for Netdata dashboard access documentation

## Task Commits

Each task was committed atomically:

1. **Task 1: Netdata configuration file (localhost-only bind)** - `04b850f` (feat)
2. **Task 2: Log rotation verification script** - `700e25d` (feat)

**Plan metadata:** (docs commit, see below)

## Files Created/Modified

- `netdata/netdata.conf` - Netdata config: localhost-only bind, memory mode save, 1h history, container monitoring plugins enabled
- `docker-compose.prod.yml` - Added `./netdata/netdata.conf:/etc/netdata/netdata.conf:ro` volume mount to netdata service
- `scripts/verify-log-rotation.sh` - Inspects all running k21 containers via docker inspect; PASS/FAIL per container; exits 1 on any failure
- `scripts/smoke-test.sh` - Appended SSH tunnel instructions for Netdata dashboard access

## Decisions Made

- Netdata config mounted as a read-only bind mount (`./netdata/netdata.conf:/etc/netdata/netdata.conf:ro`) layered on top of the `netdataconfig` named volume. This ensures the critical security setting (`bind to = 127.0.0.1`) is always applied from the git-tracked file rather than relying on volume state.
- `verify-log-rotation.sh` inspects live container runtime config via `docker inspect` rather than parsing compose files. This verifies what is actually running, not just what is defined.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Monitoring config is complete. When the production stack is deployed, SSH tunnel to `localhost:19999` provides Netdata access.
- Run `sh scripts/verify-log-rotation.sh` on the VPS after first deployment to confirm all containers have correct log rotation.
- Phase 0 infrastructure plans complete: Docker topology, Nginx, Netdata, log rotation, backup all configured.

---
*Phase: 00-infrastructure*
*Completed: 2026-03-14*
