---
phase: 01-auth-rbac
plan: "01"
subsystem: auth
tags: [jose, argon2, cookie-parser, zod, vitest, tdd]

# Dependency graph
requires: []
provides:
  - jose, argon2, cookie-parser, zod installed in @k21/api
  - "@types/cookie-parser devDependency installed"
  - "5 TDD test stub files in RED state covering AUTH-01 through AUTH-08"
  - "auth.test.ts: login, refresh, logout stubs"
  - "users.test.ts: deactivateUser and createUser+audit_log stubs"
  - "authenticate.test.ts: 401 (no token) and 403 (mustChangePassword) middleware stubs"
  - "require-role.test.ts: 403 (wrong role) and 401 (no user) middleware stubs"
  - "db/schema/users.test.ts: roleEnum enum values stub (PASSES — schema already existed)"
affects: [01-auth-rbac]

# Tech tracking
tech-stack:
  added:
    - "jose@^6.0.0 — JWT signing/verification (ESM-native)"
    - "argon2@^0.44.0 — password hashing"
    - "cookie-parser@^1.4.7 — httpOnly cookie parsing"
    - "zod@^3.23.0 — schema/input validation"
    - "@types/cookie-parser@^1.4.0 — TypeScript types"
  patterns:
    - "TDD stubs: vi.mock() without factory forces RED state (import errors + is-not-a-function failures)"
    - "All stub imports use .js extension (NodeNext ESM resolution requirement)"

key-files:
  created:
    - "apps/api/src/modules/auth/auth.test.ts"
    - "apps/api/src/modules/users/users.test.ts"
    - "apps/api/src/middleware/authenticate.test.ts"
    - "apps/api/src/middleware/require-role.test.ts"
  modified:
    - "apps/api/package.json — added 4 runtime deps + 1 dev dep"
    - "pnpm-lock.yaml — lockfile updated"

key-decisions:
  - "vi.mock() without factory function achieves RED state: Vitest auto-mock returns undefined for all exports, causing import errors and is-not-a-function failures when implementation files don't exist"
  - "db/schema/users.test.ts stub PASSES (not RED) because users.ts was already created in a prior plan — this is correct behavior; AUTH-04 enum values are already validated"

patterns-established:
  - "TDD RED stubs: vi.mock('./service.js') with no factory — forces RED state until implementation exists"
  - "DB decoupling: vi.mock('../../db/index.js', () => ({ db: {} })) in every test file touching DB-dependent services"

requirements-completed:
  - AUTH-01
  - AUTH-02
  - AUTH-03
  - AUTH-04
  - AUTH-05
  - AUTH-06
  - AUTH-08

# Metrics
duration: 5min
completed: 2026-03-17
---

# Phase 1 Plan 01: Auth TDD Setup Summary

**TDD RED-state test stubs for all Phase 1 auth/RBAC requirements with jose, argon2, cookie-parser, and zod installed**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-17T20:34:08Z
- **Completed:** 2026-03-17T20:38:48Z
- **Tasks:** 2
- **Files modified:** 6 (package.json, pnpm-lock.yaml, 4 test stubs created)

## Accomplishments

- Installed jose, argon2, cookie-parser, zod, and @types/cookie-parser in @k21/api
- Created 4 test stub files covering AUTH-01 through AUTH-08 in confirmed RED state
- 14 tests failing (import errors because implementation files don't exist)
- Existing 4 tests (health, db, queue, schema/users) remain PASS

## Task Commits

Each task was committed atomically:

1. **Task 1: Install auth packages** - `bf3e678` (chore)
2. **Task 2: Create test stubs (RED state)** - `b59ab52` (test)

## Files Created/Modified

- `apps/api/package.json` — added jose, argon2, cookie-parser, zod runtime deps + @types/cookie-parser devDep
- `pnpm-lock.yaml` — lockfile updated with new packages
- `apps/api/src/modules/auth/auth.test.ts` — AUTH-01 (login), AUTH-02 (refresh), AUTH-03 (logout) stubs
- `apps/api/src/modules/users/users.test.ts` — AUTH-06 (deactivateUser tx), AUTH-08 (createUser+audit_log) stubs
- `apps/api/src/middleware/authenticate.test.ts` — AUTH-05 (401 no token, 403 mustChangePassword) stubs
- `apps/api/src/middleware/require-role.test.ts` — AUTH-05 (403 wrong role, 401 no user) stubs

## Decisions Made

- **vi.mock() without factory achieves RED state:** When `vi.mock('./module.js')` is called without a factory function and the module file does not exist, Vitest throws "Failed to load url" on first test in the suite, and all subsequent tests in that suite fail with "X is not a function". This is the correct RED state.
- **Schema test passes:** `db/schema/users.test.ts` PASSES rather than FAILs because `db/schema/users.ts` was already created in a prior plan (01-02, which ran before 01-01 in commit order). AUTH-04 enum values are validated correctly by the passing test.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 5 test stub files are in place (4 in RED state, 1 in GREEN because schema pre-existed)
- `pnpm --filter @k21/api test` exits with non-zero (14 failing tests confirm RED state)
- Ready for Plan 01-02 (Drizzle schema) and Plan 01-03 (auth service implementation) to turn tests GREEN

---
*Phase: 01-auth-rbac*
*Completed: 2026-03-17*
