---
phase: 01-auth-rbac
plan: 03
subsystem: auth
tags: [jwt, argon2, jose, express, cookie, refresh-token, drizzle-orm]

# Dependency graph
requires:
  - phase: 01-auth-rbac/01-02
    provides: users and refresh_tokens Drizzle schema tables with correct types

provides:
  - "auth.service.ts: login(), refresh(), logout() business logic with JWT + argon2"
  - "auth.router.ts: Express router with POST /login, POST /refresh, POST /logout"
  - "modules/auth/index.ts: barrel export of authRouter"

affects: [01-04-authenticate-middleware, 01-05-require-role, 01-06-app-wiring, all subsequent phases consuming auth tokens]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Service layer returns both accessToken and refreshToken; router handles cookie-setting separation from business logic"
    - "Drizzle chainable query builder mocked at db layer in tests (not at service layer) for proper unit testing"
    - "Params as object pattern: login({ email, password }) instead of positional args — matches test call sites"

key-files:
  created:
    - apps/api/src/modules/auth/auth.service.ts
    - apps/api/src/modules/auth/auth.router.ts
    - apps/api/src/modules/auth/index.ts
  modified:
    - apps/api/src/modules/auth/auth.test.ts

key-decisions:
  - "Service function params use object destructuring ({ email, password }) to match test call sites from Plan 01"
  - "auth.test.ts auto-mock strategy (vi.mock without factory) replaced with DB-layer mocks — auto-mock returns vi.fn() stubs that return undefined, tests would never pass; proper fix is mocking at db boundary"
  - "logout() accepts optional userId for future caller convenience but only uses token for deletion — idempotent by design"

patterns-established:
  - "DB mock pattern: mock mockDbSelect/Insert/Delete as vi.fn() returning chainable { from: { where: { limit: resolvedValue } } } objects"
  - "Error codes as plain Error('INVALID_CREDENTIALS') — router maps to HTTP status; no custom error classes needed in Phase 1"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

# Metrics
duration: 3min
completed: 2026-03-18
---

# Phase 01 Plan 03: Auth Service and Router Summary

**JWT-based login/refresh/logout via jose + argon2, Express router with httpOnly cookie refresh token scoped to /api/v1/auth/refresh**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-17T20:43:01Z
- **Completed:** 2026-03-17T20:46:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- login(): verifies argon2 password hash, issues 15m HS256 JWT, creates 30d refresh token UUID in DB
- refresh(): validates refresh token existence and expiry in DB, issues new access token (no rotation)
- logout(): idempotently deletes refresh token row from DB
- authRouter: POST /login, /refresh, /logout with { success, data, error } envelope; httpOnly SameSite=strict cookie scoped to /api/v1/auth/refresh
- All 6 auth.test.ts tests GREEN; authentication middleware tests incidentally unblocked (5 tests also GREEN)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement auth.service.ts** - `ce234c1` (feat)
2. **Task 2: Implement auth.router.ts and barrel** - `26fba48` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/api/src/modules/auth/auth.service.ts` - login/refresh/logout business logic with DB queries, argon2 and jose
- `apps/api/src/modules/auth/auth.router.ts` - Express router: zod validation, cookie management, { success, data, error } responses
- `apps/api/src/modules/auth/index.ts` - barrel: `export { authRouter }`
- `apps/api/src/modules/auth/auth.test.ts` - updated mocking strategy from auto-mock to DB-layer mocks

## Decisions Made

- Service function params use object destructuring ({ email, password }) to match the existing test call sites from Plan 01 (`login({ email, password })`)
- auth.test.ts auto-mock strategy replaced: `vi.mock('./auth.service.js')` without factory returns vi.fn() stubs that return undefined — tests can never pass this way. Fixed by mocking the db layer and testing the real service
- logout() accepts optional userId for forward compatibility but only uses token for deletion

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated auth.test.ts mock strategy from auto-mock to DB-layer mocks**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** `vi.mock('./auth.service.js')` without factory causes all exports to be vi.fn() returning undefined. When tests call `await import('./auth.service.js')` in same file, they still get the auto-mock. Result: login() returns undefined, `expect(result).toHaveProperty('accessToken')` fails with "Cannot convert undefined or null to object".
- **Fix:** Replaced the auto-mock of auth.service with proper DB-layer mocking: `vi.mock('../../db/index.js', ...)` with mockDbSelect/Insert/Delete vi.fn() returning chainable query builder objects. Tests now call the real service implementation.
- **Files modified:** apps/api/src/modules/auth/auth.test.ts
- **Verification:** 6/6 auth tests GREEN
- **Committed in:** ce234c1 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in test mocking strategy)
**Impact on plan:** Required for tests to function at all. No scope creep — test file was always in scope for this plan as "auth.test.ts stubs turn GREEN".

## Issues Encountered

The pre-existing test stubs from Plan 01 used `vi.mock('./auth.service.js')` as a no-factory auto-mock, which was the correct RED state (module didn't exist → import error). However, once the file exists, vitest auto-mocks all exports as vi.fn() returning undefined — the tests still fail. The design intent was that the test stubs should become GREEN when the implementation exists, but this requires real DB mocking, not service-level auto-mocking.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- auth.service.ts and auth.router.ts complete; authRouter ready to be mounted in app wiring (Plan 06)
- Plan 04 (authenticate middleware) can now verify JWTs signed by signAccessToken (HS256, sub=userId, role, mustChangePassword claims)
- Token format established: `{ sub: userId, role, mustChangePassword, iat, exp }` — Plan 04 must match this structure

---
*Phase: 01-auth-rbac*
*Completed: 2026-03-18*

## Self-Check: PASSED

- apps/api/src/modules/auth/auth.service.ts: FOUND
- apps/api/src/modules/auth/auth.router.ts: FOUND
- apps/api/src/modules/auth/index.ts: FOUND
- .planning/phases/01-auth-rbac/01-03-SUMMARY.md: FOUND
- Commit ce234c1: FOUND
- Commit 26fba48: FOUND
