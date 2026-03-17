---
phase: 01-auth-rbac
plan: 02
subsystem: database-schema
tags: [drizzle, schema, migration, postgres, rbac]
dependency_graph:
  requires:
    - "01-01 (test stubs + auth packages)"
  provides:
    - "User, NewUser types for auth service"
    - "roleEnum for RBAC middleware"
    - "RefreshToken type for token management"
    - "AuditLog type for audit helper"
    - "Migration SQL for VPS deployment"
  affects:
    - "01-03 (auth service — imports User/RefreshToken from schema)"
    - "01-04 (middleware — imports roleEnum)"
    - "01-05 (users service — imports User/AuditLog)"
    - "01-06 (auth routes — imports User)"
tech_stack:
  added:
    - "drizzle-orm pgTable, pgEnum, uuid, varchar, boolean, timestamp, jsonb"
    - "tsx/cjs workaround for drizzle-kit v0.20 + NodeNext ESM .js extension compatibility"
  patterns:
    - "Separate schema files per table (high cohesion, low coupling)"
    - "Barrel re-export via schema/index.ts"
    - "No FK on audit_logs.userId — preserve audit trail when user is deleted"
key_files:
  created:
    - "apps/api/src/db/schema/users.ts"
    - "apps/api/src/db/schema/refresh-tokens.ts"
    - "apps/api/src/db/schema/audit-logs.ts"
    - "apps/api/src/db/schema/index.ts"
    - "apps/api/src/db/schema/users.test.ts"
    - "apps/api/drizzle.config.ts"
    - "apps/api/drizzle/0000_whole_black_tarantula.sql"
    - "apps/api/drizzle/meta/0000_snapshot.json"
    - "apps/api/drizzle/meta/_journal.json"
  modified:
    - "apps/api/src/db/index.ts (added schema import, passed to drizzle())"
    - "apps/api/package.json (added db:generate and db:push scripts)"
decisions:
  - "tsx/cjs workaround required for drizzle-kit v0.20 with NodeNext ESM — drizzle-kit uses CJS require() internally which cannot resolve .js → .ts; node --require tsx/cjs intercepts and handles correctly"
  - "audit_logs.userId has no FK constraint — intentional: logs must survive user deletion for immutable audit trail"
  - "refresh_tokens.userId has cascade delete FK — token cleanup is automatic when user is deleted"
  - "Migration SQL generated locally; push skipped (no DATABASE_URL available); must run pnpm db:push on VPS during deployment"
metrics:
  duration: "4 minutes"
  completed_date: "2026-03-17"
  tasks_completed: 2
  files_created: 9
  files_modified: 2
---

# Phase 1 Plan 2: Drizzle Schema Definition and Migration Summary

**One-liner:** Three Drizzle schema tables (users with roleEnum, refresh_tokens with cascade FK, audit_logs without FK) defined and migration SQL generated using tsx/cjs workaround for drizzle-kit v0.20 NodeNext ESM compatibility.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create Drizzle schema files | eb9e044 | users.ts, refresh-tokens.ts, audit-logs.ts, schema/index.ts, users.test.ts, db/index.ts |
| 2 | Generate and apply Drizzle migration | 53bb379 | drizzle.config.ts, drizzle/0000_*.sql, package.json |

## Success Criteria Verification

- [x] 4 schema files exist with correct exports and .js extensions on relative imports
- [x] db/index.ts updated to pass `{ schema }` to drizzle()
- [x] drizzle.config.ts points to schema/index.ts
- [x] Migration SQL file generated in apps/api/drizzle/
- [x] AUTH-04 schema test turns GREEN (`roleEnum.enumValues` matches exactly)

## Schema Details

### roleEnum (`user_role` postgres type)
Values: `['Owner', 'Finance', 'Warehouse Staff', 'Cashier', 'Admin']`

### users table
`id` (uuid PK), `email` (varchar 255, unique), `password_hash` (varchar 255), `role` (user_role enum), `is_active` (bool, default true), `must_change_password` (bool, default true), `created_at`, `updated_at`

### refresh_tokens table
`id` (uuid PK), `user_id` (uuid FK → users.id, cascade delete), `token` (varchar 36, unique), `expires_at`, `created_at`

### audit_logs table
`id` (uuid PK), `user_id` (uuid, **no FK**), `action` (audit_action enum: CREATE/UPDATE/DELETE), `table_name` (varchar 100), `record_id` (uuid), `old_value` (jsonb), `new_value` (jsonb), `ip_address` (varchar 45), `created_at`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created missing users.test.ts schema stub**
- **Found during:** Task 1 pre-check
- **Issue:** Plan 01-01 depended-on artifact `apps/api/src/db/schema/users.test.ts` was missing. Plan 02 Task 1 is TDD and requires the test file to exist in RED state before implementation.
- **Fix:** Created `users.test.ts` schema stub (RED, importing non-existent `./users.js`), then created schema files to turn it GREEN — completing the TDD RED → GREEN cycle as specified.
- **Files modified:** apps/api/src/db/schema/users.test.ts (created)
- **Commit:** eb9e044

**2. [Rule 1 - Bug] drizzle-kit v0.20 cannot resolve NodeNext .js imports**
- **Found during:** Task 2
- **Issue:** `pnpm drizzle-kit generate:pg` failed with `Cannot find module './users.js'` — drizzle-kit v0.20 uses CJS `require()` internally to load TypeScript schema files, which cannot resolve NodeNext ESM `.js` extension aliases to `.ts` files.
- **Fix:** Added `node --require tsx/cjs` prefix to drizzle-kit CLI invocation. `tsx/cjs` installs a CJS require hook that correctly resolves `.js` → `.ts` for TypeScript files.
- **Files modified:** apps/api/package.json (db:generate and db:push scripts), apps/api/drizzle.config.ts (created)
- **Commit:** 53bb379

## Migration Deployment Note

`DATABASE_URL` was not available in the local environment. The migration SQL has been generated but not applied. **To apply on VPS:**

```bash
cd /opt/k21/apps/api
DATABASE_URL=<connection-string> pnpm db:push
```

Or run the SQL directly against the Postgres instance during the Phase 1 deployment step.

## Self-Check: PASSED

- [x] apps/api/src/db/schema/users.ts exists
- [x] apps/api/src/db/schema/refresh-tokens.ts exists
- [x] apps/api/src/db/schema/audit-logs.ts exists
- [x] apps/api/src/db/schema/index.ts exists
- [x] apps/api/drizzle/0000_whole_black_tarantula.sql exists
- [x] Commit eb9e044 exists (Task 1)
- [x] Commit 53bb379 exists (Task 2)
