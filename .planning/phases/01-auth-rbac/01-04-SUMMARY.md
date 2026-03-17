---
phase: 01-auth-rbac
plan: "04"
subsystem: auth
tags: [jwt, jose, express, middleware, rbac, audit-logging]

# Dependency graph
requires:
  - phase: 01-auth-rbac/01-02
    provides: Drizzle schema for audit_logs table (auditLogs, actionEnum)
  - phase: 01-auth-rbac/01-01
    provides: Test stubs for authenticate.test.ts and require-role.test.ts in RED state

provides:
  - authenticate RequestHandler — verifies JWT Bearer token, attaches req.user, blocks mustChangePassword paths
  - requireRole(...roles) factory — RBAC guard checking req.user.role against allowed roles
  - logAudit() async helper — inserts rows into audit_logs via Drizzle
  - Express Request augmentation (req.user typed with sub, role, mustChangePassword)

affects: [01-auth-rbac/01-05, 01-auth-rbac/01-06, all protected routes in subsequent phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - authenticate middleware: jwtVerify via jose, attaches req.user to Express Request
    - requireRole factory: spread-args role list, checks req.user.role inclusion
    - logAudit helper: randomUUID for id, Drizzle insert pattern for audit_logs

key-files:
  created:
    - apps/api/src/middleware/authenticate.ts
    - apps/api/src/middleware/require-role.ts
    - apps/api/src/middleware/audit.ts
    - apps/api/src/types/express.d.ts
  modified:
    - apps/api/src/middleware/authenticate.test.ts
    - apps/api/src/middleware/require-role.test.ts

key-decisions:
  - "authenticate uses req.path.endsWith('/auth/change-password') to allow password change even when mustChangePassword=true"
  - "Test files updated to use real SignJWT token generation instead of vi.mock auto-stub — tests verify actual behavior"
  - "logAudit uses randomUUID for id generation (crypto built-in) rather than relying on DB default"

patterns-established:
  - "Middleware pattern: res.status(N).json({success, data, error}) + return — consistent error envelope"
  - "TDD with real JWT: authenticate tests sign real tokens with SignJWT, verifying actual jwtVerify behavior"

requirements-completed: [AUTH-04, AUTH-05, AUTH-08]

# Metrics
duration: 2min
completed: 2026-03-17
---

# Phase 01 Plan 04: Middleware Building Blocks Summary

**JWT Bearer authentication middleware, RBAC role guard, and audit log helper using jose jwtVerify — all middleware test stubs turned GREEN**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-17T20:43:27Z
- **Completed:** 2026-03-17T20:45:54Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- authenticate.ts verifies JWT Bearer tokens via jose jwtVerify, attaches req.user, blocks mustChangePassword paths with 403
- requireRole(...roles) factory guards routes by checking req.user.role against allowed role list
- logAudit() helper inserts audit_logs rows via Drizzle with correct schema mapping
- Express type declaration (express.d.ts) extends Request with typed req.user

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement authenticate middleware and Express type augmentation** - `1f3f098` (feat)
2. **Task 2: Implement requireRole middleware and logAudit helper** - `06c319e` (feat)

## Files Created/Modified
- `apps/api/src/middleware/authenticate.ts` - JWT verification middleware, req.user attachment, mustChangePassword gate
- `apps/api/src/types/express.d.ts` - Express Request augmentation for req.user type
- `apps/api/src/middleware/require-role.ts` - RBAC factory: requireRole(...roles) → RequestHandler
- `apps/api/src/middleware/audit.ts` - logAudit() async helper for inserting audit_logs rows
- `apps/api/src/middleware/authenticate.test.ts` - Updated to use real SignJWT tokens (5 tests GREEN)
- `apps/api/src/middleware/require-role.test.ts` - Updated to use real implementation (4 tests GREEN)

## Decisions Made
- Test stubs from Plan 01 used `vi.mock('./authenticate.js')` without factory — achieving RED via "is not a function" errors. Implementation required removing that mock and using real JWT signing via SignJWT in tests to verify actual behavior.
- `req.path.endsWith('/auth/change-password')` used for mustChangePassword path check — allows the exact endpoint regardless of URL prefix depth.
- logAudit uses `randomUUID()` from Node crypto built-in to generate the id explicitly rather than relying on DB defaultRandom() — ensures audit row id is known at call time if needed.

## Deviations from Plan

**1. [Rule 3 - Blocking] Test files required updating to remove vi.mock auto-stubs**
- **Found during:** Task 1 (authenticate implementation)
- **Issue:** Tests used `vi.mock('./authenticate.js')` without factory, causing auto-mock to return undefined functions. Real implementation cannot be tested while the module is auto-mocked.
- **Fix:** Removed vi.mock stubs from both test files, replaced with real JWT token signing (SignJWT) in authenticate.test.ts for proper integration testing.
- **Files modified:** apps/api/src/middleware/authenticate.test.ts, apps/api/src/middleware/require-role.test.ts
- **Verification:** 5 authenticate tests + 4 require-role tests all GREEN
- **Committed in:** 1f3f098, 06c319e

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking)
**Impact on plan:** Test stub update was necessary for tests to exercise real implementation. No scope creep.

## Issues Encountered
None beyond the vi.mock auto-stub deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- authenticate, requireRole, and logAudit are ready for consumption by protected route handlers
- Plans 05/06 (auth service, users service) can now import from middleware/authenticate.js, middleware/require-role.js, and middleware/audit.js
- users.test.ts still has 2 failing tests (users.service.js not yet implemented) — expected pre-existing RED state for future plan

---
*Phase: 01-auth-rbac*
*Completed: 2026-03-17*
