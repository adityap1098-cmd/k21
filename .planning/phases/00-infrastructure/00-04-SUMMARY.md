---
phase: 00-infrastructure
plan: "04"
subsystem: api
tags: [express, drizzle-orm, postgres-js, bullmq, ioredis, docker, nextjs, pnpm-workspace]

# Dependency graph
requires:
  - phase: 00-01
    provides: Vitest test stubs (RED state, awaiting implementation)
  - phase: 00-02
    provides: pnpm monorepo, tsconfig.base.json, @k21/shared, dependency declarations
provides:
  - Express app with /health endpoint and /api/v1 router prefix
  - Drizzle ORM client over postgres.js with prepare:false (PgBouncer safe)
  - BullMQ ConnectionOptions from env vars
  - Named BullMQ queues (marketplace, reports)
  - Multi-stage API Dockerfile with pnpm workspace support
  - Multi-stage Web Dockerfile with Next.js standalone output
  - Minimal Next.js app pages (layout + page)
affects:
  - 00-05 (Nginx/reverse-proxy config can now reference running API container)
  - all subsequent phases (API skeleton is the base for all feature plans)

# Tech tracking
tech-stack:
  added:
    - express (app skeleton with /health and /api/v1)
    - postgres.js with prepare:false (PgBouncer TRANSACTION mode)
    - drizzle-orm/postgres-js (db client)
    - bullmq Queue + ConnectionOptions (queue definitions)
    - Docker multi-stage builds for pnpm monorepo
  patterns:
    - Express app exported as named export (required by supertest)
    - PgBouncer pattern: postgres({ prepare: false }) disables prepared statements
    - Fail-fast: DATABASE_URL checked at module load, throws immediately if missing
    - Docker build.context at repo root so all workspace manifests are accessible
    - Next.js standalone output for minimal production Docker image

key-files:
  created:
    - apps/api/src/index.ts
    - apps/api/src/db/index.ts
    - apps/api/src/queue/connection.ts
    - apps/api/src/queue/queues.ts
    - apps/api/Dockerfile
    - apps/web/Dockerfile
    - apps/web/src/app/layout.tsx
    - apps/web/src/app/page.tsx
  modified:
    - apps/web/next.config.ts (added output:'standalone')

key-decisions:
  - "queues.ts uses .js extension on relative import of connection.ts — required by NodeNext ESM resolution established in 00-02"
  - "db/index.ts throws at startup if DATABASE_URL missing — fail fast over silent null"
  - "Web Dockerfile copies from apps/web/public — directory is empty now but path must exist for standalone server.js"

patterns-established:
  - "All Queue instances defined in queues.ts, connection config isolated in connection.ts"
  - "Express app never calls listen() in test env (NODE_ENV=test guard)"
  - "Both Dockerfiles share the same 3-stage pattern: deps / builder / runner"

requirements-completed:
  - INFRA-02
  - INFRA-03
  - INFRA-08

# Metrics
duration: 2min
completed: 2026-03-15
---

# Phase 0 Plan 04: API Skeleton and Dockerfiles Summary

**Express API skeleton with /health endpoint, Drizzle postgres.js client (prepare:false for PgBouncer), BullMQ queue connections, and multi-stage pnpm-aware Dockerfiles — turning all three RED test stubs GREEN**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-14T18:14:18Z
- **Completed:** 2026-03-14T18:15:53Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Implemented `apps/api/src/index.ts`: Express app with `/health` (200 + timestamp) and `/api/v1` router mount; `app` exported as named export for supertest
- Implemented `apps/api/src/db/index.ts`: Drizzle ORM over postgres.js with `{ prepare: false }` — the critical PgBouncer TRANSACTION mode requirement
- Implemented `apps/api/src/queue/connection.ts`: `ConnectionOptions` from env vars (REDIS_HOST, REDIS_PORT, REDIS_PASSWORD) with sensible defaults
- Implemented `apps/api/src/queue/queues.ts`: `marketplaceQueue` and `reportQueue` Queue instances, no workers yet
- Created `apps/api/Dockerfile`: 3-stage multi-stage build (deps/builder/runner) using pnpm `--filter @k21/api...` for workspace-aware install
- Created `apps/web/Dockerfile`: 3-stage build with `NEXT_TELEMETRY_DISABLED=1` and standalone output copy
- Updated `apps/web/next.config.ts`: Added `output: 'standalone'` for Docker standalone mode
- Created minimal Next.js app pages: `layout.tsx` (RootLayout) and `page.tsx` (K21 ERP landing) so `next build` succeeds
- All three Vitest test stubs turned GREEN: `pnpm --filter @k21/api test --run` exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Express app, DB client, and BullMQ queue setup** - `ba5169b` (feat)
2. **Task 2: Dockerfiles for API and Web** - `d5fd14d` (feat)

## Files Created/Modified

- `apps/api/src/index.ts` - Express app: /health, /api/v1 router, named `app` export, no-listen guard for tests
- `apps/api/src/db/index.ts` - Drizzle ORM client with postgres.js and `prepare: false`
- `apps/api/src/queue/connection.ts` - BullMQ `ConnectionOptions` from env vars
- `apps/api/src/queue/queues.ts` - `marketplaceQueue` and `reportQueue` Queue definitions
- `apps/api/Dockerfile` - Multi-stage build: pnpm workspace-aware install, shared+api compile, slim runner
- `apps/web/Dockerfile` - Multi-stage build: pnpm workspace-aware install, next build, standalone runner
- `apps/web/next.config.ts` - Added `output: 'standalone'` for Docker standalone mode
- `apps/web/src/app/layout.tsx` - Minimal RootLayout (html/body wrapper)
- `apps/web/src/app/page.tsx` - Minimal Page component (K21 ERP h1)

## Decisions Made

- `queues.ts` uses `.js` extension on the relative import of `connection.ts` to comply with NodeNext ESM resolution (established in 00-02)
- `db/index.ts` throws at module load if `DATABASE_URL` is missing — fail fast is safer than returning a broken client
- Both Dockerfiles copy workspace manifests (package.json, pnpm-workspace.yaml, pnpm-lock.yaml) from repo root before running pnpm install, matching the `build.context: .` constraint from docker-compose.yml

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. All three test stubs turned GREEN on first run. `docker compose config --quiet` validated cleanly.

## User Setup Required

None — no external service configuration required.

## Self-Check: PASSED

Files exist:
- FOUND: apps/api/src/index.ts
- FOUND: apps/api/src/db/index.ts
- FOUND: apps/api/src/queue/connection.ts
- FOUND: apps/api/src/queue/queues.ts
- FOUND: apps/api/Dockerfile
- FOUND: apps/web/Dockerfile
- FOUND: apps/web/src/app/layout.tsx
- FOUND: apps/web/src/app/page.tsx

Commits exist:
- FOUND: ba5169b (feat(00-04): Express app, Drizzle DB client, and BullMQ queue connections)
- FOUND: d5fd14d (feat(00-04): multi-stage Dockerfiles and Next.js app pages)

## Next Phase Readiness

- `pnpm --filter @k21/api test --run` is GREEN — CI gate is satisfied
- Express API is ready to receive Phase 1+ routes under `/api/v1`
- DB client and queue connections are initialized and tested
- Both Dockerfiles are ready for `docker compose up --build`
- Plan 00-05 (Nginx reverse proxy) can now configure upstream to port 3001

---
*Phase: 00-infrastructure*
*Completed: 2026-03-15*
