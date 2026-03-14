---
phase: 00-infrastructure
plan: "03"
subsystem: infra

tags: [docker, docker-compose, postgres, pgbouncer, redis, nginx, certbot, netdata]

# Dependency graph
requires:
  - phase: 00-01
    provides: monorepo structure and pnpm workspace needed for build.context references

provides:
  - docker-compose.yml base service definitions with healthchecks and log rotation
  - docker-compose.prod.yml production overrides with Nginx, certbot, Netdata
  - docker-compose.dev.yml development overrides with hot-reload and direct port access
  - pgbouncer/pgbouncer.ini in TRANSACTION pool mode
  - pgbouncer/userlist.txt placeholder for MD5 auth

affects: [00-04, 00-05, 00-06, 00-07, all application phases]

# Tech tracking
tech-stack:
  added:
    - postgres:16-alpine
    - edoburu/pgbouncer:1.23-p1
    - redis:7-alpine
    - nginx:1.25-alpine
    - certbot/certbot
    - netdata/netdata
  patterns:
    - Base + override Compose split (base, prod, dev)
    - All services on single internal bridge network (k21-net)
    - Log rotation on every service (json-file, max-size 10m, max-file 5)
    - Healthcheck-gated startup ordering via condition: service_healthy

key-files:
  created:
    - docker-compose.yml
    - docker-compose.prod.yml
    - docker-compose.dev.yml
    - pgbouncer/pgbouncer.ini
    - pgbouncer/userlist.txt
  modified: []

key-decisions:
  - "PgBouncer in TRANSACTION pool mode — requires postgres.js driver (not pg) in application layer"
  - "Dev override named docker-compose.dev.yml (not override.yml) to prevent Docker auto-merging into prod runs"
  - "Postgres exposed on host:5433 in dev to avoid conflict with local postgres installs"
  - "Only Nginx (in prod override) has externally published ports — PgBouncer and Redis are internal only"

patterns-established:
  - "All services on k21-net bridge network — service name resolution only"
  - "Log rotation json-file driver: max-size 10m, max-file 5 — applied to every service"
  - "Healthcheck condition: service_healthy for dependency ordering"
  - "Dev ports bound to 127.0.0.1 only for security"

requirements-completed: [INFRA-01, INFRA-02, INFRA-03, INFRA-05]

# Metrics
duration: 3min
completed: 2026-03-15
---

# Phase 0 Plan 03: Docker Compose Topology Summary

**Three-file Compose topology with PgBouncer transaction pooling, per-service log rotation, and Nginx-only external ports**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-14T18:06:54Z
- **Completed:** 2026-03-15T18:09:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Complete Docker Compose service graph: postgres, pgbouncer, redis, api, web, backup (base) + nginx, certbot, netdata (prod override)
- PgBouncer configured in TRANSACTION pool mode with MD5 auth and all tuning parameters set
- Log rotation (max-size: 10m, max-file: 5) applied to every service across all three files
- Dev override safely isolated by naming convention (docker-compose.dev.yml, not override.yml)
- All three Compose files validated with `docker compose config` — topology is structurally correct

## Task Commits

Each task was committed atomically:

1. **Task 1: docker-compose.yml (base) with healthchecks and log rotation** - `25589e4` (feat)
2. **Task 2: docker-compose.prod.yml and docker-compose.dev.yml overrides** - `9d0f164` (feat)

## Files Created/Modified

- `docker-compose.yml` - Base service definitions: 6 services (postgres, pgbouncer, redis, api, web, backup), all on k21-net, healthchecks, log rotation, no external ports on DB services
- `docker-compose.prod.yml` - Production overrides: nginx (80/443), certbot (auto-renewal loop), netdata (host network), restart policies, NODE_ENV=production
- `docker-compose.dev.yml` - Dev overrides: hot-reload volume mounts for api/web src, direct port access on 127.0.0.1, NODE_ENV=development, postgres on host:5433
- `pgbouncer/pgbouncer.ini` - PgBouncer in TRANSACTION mode, max_client_conn=100, default_pool_size=20, MD5 auth
- `pgbouncer/userlist.txt` - Placeholder with MD5 hash generation instructions for deploy-time population

## Decisions Made

- PgBouncer TRANSACTION pool mode confirmed — application layer (api) must use `postgres.js` driver with prepared statements disabled; this was a pre-phase decision now locked into config
- Dev file named `docker-compose.dev.yml` deliberately to prevent Docker from auto-applying it as an override when running base-only or prod commands
- Postgres dev host port set to 5433 (not 5432) to avoid conflicts with any locally installed postgres

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. All three `docker compose config` validations passed on first attempt. Env var warnings are expected behavior (no .env file in dev context).

## User Setup Required

Before running production stack, populate `pgbouncer/userlist.txt` with a real MD5 hash:

```bash
echo -n "${POSTGRES_PASSWORD}${POSTGRES_USER}" | md5sum | awk '{print "md5"$1}'
```

Replace the `md5CHANGEME` placeholder with the generated hash. The deploy pipeline (Plan 00-07) will automate this step.

## Next Phase Readiness

- Docker Compose topology is complete and validated — ready for Plan 00-04 (Nginx config) and Plan 00-05 (Dockerfiles)
- PgBouncer TRANSACTION mode constraint must be carried forward to api Dockerfile and application configuration
- The `backup` service references `./backup/Dockerfile` which is a placeholder until Plan 00-06

## Self-Check: PASSED

- All 5 artifact files verified on disk
- SUMMARY.md verified on disk
- Commits 25589e4 and 9d0f164 verified in git log

---
*Phase: 00-infrastructure*
*Completed: 2026-03-15*
