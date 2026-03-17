---
phase: 01-auth-rbac
plan: 05
subsystem: auth
tags: [argon2, drizzle-orm, express, zod, typescript, users, audit-log, rbac]

# Dependency graph
requires:
  - phase: 01-02
    provides: users and refreshTokens Drizzle schema tables
  - phase: 01-04
    provides: authenticate middleware, requireRole middleware, logAudit function

provides:
  - createUser(params, adminId, ipAddress) with argon2id hashing and audit log
  - getAllUsers() returning users without passwordHash
  - updateUser(userId, updates, adminId, ipAddress) with old/new audit log
  - deactivateUser({ userId }) atomic transaction (isActive=false + delete refresh tokens)
  - usersRouter Express router with GET/POST/PATCH /users routes guarded by Admin role

affects: [01-06, 01-wiring, any phase that needs user management endpoints]

# Tech tracking
tech-stack:
  added: []
  patterns: [service-layer pattern, object-param destructuring for optional adminId/ip, auditLog embedded in createUser return for test compatibility]

key-files:
  created:
    - apps/api/src/modules/users/users.service.ts
    - apps/api/src/modules/users/users.router.ts
    - apps/api/src/modules/users/index.ts
  modified:
    - apps/api/src/modules/users/users.test.ts

key-decisions:
  - "deactivateUser accepts object param { userId, adminId?, ipAddress? } to match test call site deactivateUser({ userId })"
  - "createUser returns { ...user, auditLog } to satisfy AUTH-08 test assertion on result.auditLog"
  - "users.test.ts stubs updated from vi.mock auto-stub to DB-layer mocks — consistent with auth.test.ts pattern"
  - "passwordHash excluded via destructuring in router responses, never returned to API clients"

patterns-established:
  - "Service function optional params: adminId and ipAddress default to 'system'/'0.0.0.0' so tests can call without them"
  - "Router strips internal service fields (passwordHash, auditLog) before JSON response"

requirements-completed: [AUTH-06, AUTH-08]

# Metrics
duration: 5min
completed: 2026-03-17
---

# Phase 01 Plan 05: User Management Module Summary

**Admin user management with argon2id-hashed user creation, role updates, and atomic deactivation (isActive=false + refresh token hard-delete in one transaction) with full audit logging**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-17T20:49:53Z
- **Completed:** 2026-03-17T20:54:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- users.service.ts: createUser (argon2id, mustChangePassword=true, returns auditLog), getAllUsers (no passwordHash), updateUser (old/new audit), deactivateUser (atomic transaction)
- users.router.ts: GET/POST/PATCH routes all guarded by [authenticate, requireRole('Admin')], passwordHash never in response
- Barrel index.ts exports usersRouter
- users.test.ts stubs upgraded from auto-mock to DB-layer mocks — AUTH-06 and AUTH-08 both GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement users.service.ts** - `27bd999` (feat)
2. **Task 2: Implement users.router.ts and barrel** - `0ecd9b4` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `apps/api/src/modules/users/users.service.ts` - createUser, getAllUsers, updateUser, deactivateUser business logic
- `apps/api/src/modules/users/users.router.ts` - Express router with GET /users, POST /users, PATCH /users/:id
- `apps/api/src/modules/users/index.ts` - Barrel re-export of usersRouter
- `apps/api/src/modules/users/users.test.ts` - Updated from auto-mock stubs to DB-layer mocks

## Decisions Made

- `deactivateUser` accepts an object param `{ userId, adminId?, ipAddress? }` rather than positional args — test call site uses `deactivateUser({ userId: 'user-uuid' })` and this preserves backward compatibility
- `createUser` returns `{ ...user, auditLog }` to satisfy the test assertion `expect(result.auditLog).toMatchObject({ action: 'CREATE', tableName: 'users', userId: result.id })` — the auditLog object is stripped by the router before sending to API clients
- Test stubs updated to DB-layer mocks consistent with the pattern established in auth.test.ts (STATE.md decision: "auth.test.ts auto-mock replaced with DB-layer mocks")

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test update] Updated users.test.ts auto-mocks to DB-layer mocks**
- **Found during:** Task 1 (TDD RED phase)
- **Issue:** Original stubs used `vi.mock('./users.service.js')` without factory — auto-mock returns `vi.fn()` that returns `undefined`. `expect(result).toMatchObject({ isActive: false })` would always fail since result is undefined. Tests were permanently stuck in a non-meaningful RED state.
- **Fix:** Replaced auto-mock with chainable DB mock pattern (same as auth.test.ts). Added argon2 mock and logAudit mock. Tests now test real service behavior.
- **Files modified:** apps/api/src/modules/users/users.test.ts
- **Verification:** 2/2 tests pass after service implementation
- **Committed in:** 27bd999 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - test correctness fix)
**Impact on plan:** Required for tests to meaningfully verify implementation. Consistent with existing project pattern.

## Issues Encountered

Pre-existing TypeScript errors in `src/middleware/authenticate.test.ts`, `src/middleware/require-role.test.ts`, and `src/queue/connection.test.ts` — none in the files created by this plan. Logged as out-of-scope per scope boundary rules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Users module complete: service + router + barrel all ready for wiring into the main app router
- deactivateUser hard-deletes refresh tokens in one transaction — AUTH-06 "immediately loses access" requirement met
- All mutations write to audit_logs — AUTH-08 requirement met
- usersRouter ready to be mounted at /api/v1/users in the wiring plan

---
*Phase: 01-auth-rbac*
*Completed: 2026-03-17*
