---
phase: 00-infrastructure
plan: "02"
subsystem: infra
tags: [pnpm, typescript, monorepo, workspace, nodejs, nextjs, shared-package]

# Dependency graph
requires:
  - phase: 00-01
    provides: Docker/Nginx scaffolding and test infrastructure
provides:
  - pnpm monorepo workspace config (apps/*, packages/*)
  - tsconfig.base.json with NodeNext module resolution
  - "@k21/shared package with ApiResponse<T> stub"
  - apps/api package.json with workspace:* dep on @k21/shared
  - apps/web Next.js stub with transpilePackages for @k21/shared
  - .env.example documenting all 13 required environment variables
affects: [00-03, 00-04, all subsequent phases using @k21/shared]

# Tech tracking
tech-stack:
  added: [pnpm workspaces, typescript 5.4, eslint 9, @typescript-eslint 8, bullmq, drizzle-orm, ioredis, postgres, nextjs 14, react 18]
  patterns: [NodeNext module resolution with .js extensions, workspace:* protocol for internal packages, base tsconfig extended per app]

key-files:
  created:
    - tsconfig.base.json
    - .env.example
    - packages/shared/package.json
    - packages/shared/tsconfig.json
    - packages/shared/src/index.ts
    - apps/web/package.json
    - apps/web/tsconfig.json
    - apps/web/next.config.ts
  modified:
    - package.json
    - .gitignore
    - apps/api/package.json
    - apps/api/tsconfig.json
    - apps/api/src/index.test.ts
    - apps/api/src/db/index.test.ts
    - apps/api/src/queue/connection.test.ts

key-decisions:
  - "NodeNext module resolution requires explicit .js extensions on relative imports — fixed in test stubs from plan 00-01"
  - "apps/web tsconfig uses ESNext+Bundler resolution overriding base NodeNext — required by Next.js App Router"
  - "apps/api set as type:module to match NodeNext ESM expectations"

patterns-established:
  - "All workspace packages extend ../../tsconfig.base.json"
  - "Internal packages use workspace:* protocol, not version numbers"
  - "NodeNext resolution: all dynamic import() and vi.mock() paths must use .js extension"

requirements-completed: [INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, INFRA-08]

# Metrics
duration: 5min
completed: 2026-03-14
---

# Phase 00: Plan 02: Monorepo Workspace Scaffold Summary

**pnpm monorepo with @k21/shared (ApiResponse<T> stub), @k21/api (NodeNext/ESM), and @k21/web (Next.js 14) linked via workspace:* protocol, with tsconfig.base.json and .env.example documenting 13 environment variables**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-14T18:07:17Z
- **Completed:** 2026-03-14T18:11:47Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Root workspace config updated with proper scripts (typecheck, lint), engines constraints, and eslint devDependencies
- tsconfig.base.json created with NodeNext module resolution, strict mode, and declaration emit — extended by all workspaces
- @k21/shared package created with ApiResponse<T> type stub, builds to dist/ via tsc
- apps/api upgraded to ESM (type:module), NodeNext tsconfig, and workspace:* dep on @k21/shared (symlinked correctly)
- apps/web created with Next.js 14 stub, ESNext/Bundler tsconfig, and transpilePackages for @k21/shared
- .env.example committed with all 13 required variable names (DATABASE_URL through NODE_ENV)

## Task Commits

Each task was committed atomically:

1. **Task 1: Root workspace config, tsconfig base, and .env.example** - `059ce31` (chore)
2. **Task 2: @k21/shared package + @k21/api and @k21/web stubs** - `77d963d` (feat)

**Plan metadata:** (created in this step)

## Files Created/Modified
- `tsconfig.base.json` - Shared TS config (NodeNext, strict, declaration emit) extended by all apps
- `.env.example` - All 13 required env var names documented with placeholder values
- `packages/shared/src/index.ts` - Phase 0 stub exporting ApiResponse<T> type
- `packages/shared/package.json` - @k21/shared package with exports map and build script
- `apps/api/package.json` - Updated with @k21/shared workspace:*, bullmq, drizzle-orm, ioredis, postgres; type:module
- `apps/api/tsconfig.json` - Now extends tsconfig.base.json with NodeNext
- `apps/web/next.config.ts` - Next.js config with transpilePackages: ['@k21/shared']
- `package.json` - Updated scripts to use typecheck/lint names, added eslint devDeps

## Decisions Made
- NodeNext module resolution chosen for ESM correctness — requires .js extensions in all relative imports
- apps/web overrides module to ESNext+Bundler as required by Next.js App Router (cannot use NodeNext with Next.js)
- apps/api set as type:module to align with NodeNext ESM expectations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed NodeNext import extension errors in existing test stubs**
- **Found during:** Task 2 (api typecheck verification)
- **Issue:** Plan 00-01 test stubs used bare relative imports (`./index`, `./connection`) which fail under NodeNext moduleResolution requiring explicit .js extensions
- **Fix:** Added .js extensions to all vi.mock() and dynamic import() calls in 3 test files
- **Files modified:** apps/api/src/index.test.ts, apps/api/src/db/index.test.ts, apps/api/src/queue/connection.test.ts
- **Verification:** TS2834 errors resolved; remaining errors are TS2307 (module not found for unimplemented src files — acceptable per plan, implementations come in Plan 00-04)
- **Committed in:** 77d963d (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — NodeNext extension requirement)
**Impact on plan:** Fix necessary for correctness; test stubs from plan 00-01 predated NodeNext tsconfig. No scope creep.

## Issues Encountered
- `pnpm --filter @k21/api run typecheck` shows TS2307 errors for unimplemented source files (db/index.ts, queue/connection.ts) — this is explicitly accepted by the plan, as these implementations come in Plan 00-04.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Monorepo scaffold complete — all workspace packages link correctly
- @k21/shared builds to dist/ and is resolvable in apps/api via workspace symlink
- tsconfig.base.json established as extension point for all future packages
- .env.example is the authoritative list of required secrets — copy to .env and fill before running
- Plans 00-03 (Docker Compose) and 00-04 (API implementation) can now proceed with build graph in place

---
*Phase: 00-infrastructure*
*Completed: 2026-03-14*
