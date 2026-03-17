---
phase: 01-auth-rbac
plan: 06
subsystem: api
tags: [express, cookie-parser, auth, rbac, integration, trust-proxy]

# Dependency graph
requires:
  - phase: 01-auth-rbac/01-03
    provides: authRouter (POST /login, /refresh, /logout)
  - phase: 01-auth-rbac/01-04
    provides: authenticate middleware + JWT validation
  - phase: 01-auth-rbac/01-05
    provides: usersRouter (GET /, POST /, PATCH /:id — Admin-only)

provides:
  - Express app with authRouter mounted at /api/v1/auth
  - Express app with usersRouter mounted at /api/v1/users
  - cookieParser registered before all route handlers
  - trust proxy = 1 set for correct req.ip from X-Forwarded-For
  - JWT_SECRET fail-fast validation for production
  - apps/api/.env.example with JWT_SECRET entry
  - AUTH-07 integration tests confirming /api/v1/ prefix routing

affects: [02-inventory, 03-pos, all future phases using /api/v1/ routes]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - cookie-parser registered globally before route handlers
    - trust proxy = 1 for Nginx reverse-proxy environments
    - JWT_SECRET fail-fast: throw at startup if missing in production

key-files:
  created:
    - apps/api/.env.example
  modified:
    - apps/api/src/index.ts
    - apps/api/src/index.test.ts

key-decisions:
  - "No COOKIE_SECRET needed — refresh token in cookie is a random UUID validated against DB; cookie signing adds no security value"
  - "JWT_SECRET fail-fast only in production mode — dev/test can run without it for convenience"
  - "Pre-existing typecheck errors in middleware test files deferred — not caused by this plan's changes"

patterns-established:
  - "Integration test mocks: vi.mock auth.service and db/schema to prevent DB connections in index tests"

requirements-completed:
  - AUTH-07

# Metrics
duration: 3min
completed: 2026-03-18
---

# Phase 1 Plan 06: Express App Integration Summary

**cookieParser + trust proxy + authRouter + usersRouter wired into Express, completing all /api/v1/ routes; 23 tests GREEN**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T03:57:21Z
- **Completed:** 2026-03-18T04:00:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Mounted authRouter at `/api/v1/auth` and usersRouter at `/api/v1/users` — all Phase 1 routes now reachable
- Registered cookie-parser before route handlers and set `trust proxy = 1` for production Nginx setup
- Added JWT_SECRET fail-fast guard for production mode
- Created `apps/api/.env.example` with all required environment variables documented
- Added AUTH-07 integration tests confirming `/api/v1/` prefix routing with correct status codes

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire modules into Express app** - `0dd3100` (feat)
2. **Task 2: Update index.test.ts for AUTH-07 and run full suite** - `4d16f5f` (test)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `apps/api/src/index.ts` - Added cookieParser, trust proxy, JWT_SECRET guard, authRouter + usersRouter mounts
- `apps/api/src/index.test.ts` - Added AUTH-07 describe block with /api/v1/auth/login and /api/v1/users tests
- `apps/api/.env.example` - Created with NODE_ENV, PORT, DATABASE_URL, REDIS_HOST/PORT, JWT_SECRET entries

## Decisions Made

- No COOKIE_SECRET added to `.env.example` — cookie-parser is used without signing because the refresh token in the cookie is a random UUID validated against DB, making cookie signing redundant
- JWT_SECRET fail-fast guard scoped to `NODE_ENV === 'production'` only — allows dev/test to run without the secret for convenience
- Pre-existing TypeScript errors in `middleware/authenticate.test.ts`, `middleware/require-role.test.ts`, and `queue/connection.test.ts` are out of scope for this plan; deferred for future cleanup

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `pnpm --filter @k21/api typecheck` reports 7 pre-existing errors in test files not modified by this plan. These are carried over from prior plans and are not introduced by plan 01-06 changes. The files I modified (`src/index.ts`, `src/index.test.ts`) have zero TypeScript errors.

## User Setup Required

None - no external service configuration required. Copy `apps/api/.env.example` to `apps/api/.env` and fill in real values.

## Next Phase Readiness

- All Phase 1 (Auth & RBAC) routes are live under `/api/v1/`
- Full test suite is GREEN (23 tests, 8 files)
- Phase 2 (Inventory) can now add new routers by following the same pattern: create module, export router, mount in index.ts under `v1Router.use('/inventory', inventoryRouter)`

---
*Phase: 01-auth-rbac*
*Completed: 2026-03-18*
