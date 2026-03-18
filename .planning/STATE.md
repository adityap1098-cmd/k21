---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: completed
stopped_at: Completed 03-pos-with-offline-mode/03-04-PLAN.md
last_updated: "2026-03-18T08:27:51.104Z"
last_activity: 2026-03-15 — Phase 0 infrastructure fully verified on live VPS; all 8 smoke-test checks approved by operator
progress:
  total_phases: 10
  completed_phases: 3
  total_plans: 31
  completed_plans: 27
  percent: 10
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-14)

**Core value:** Zero inventory discrepancy — every stock movement from any source is recorded in an immutable audit trail traceable to the originating transaction
**Current focus:** Phase 0 — Infrastructure

## Current Position

Phase: 0 of 9 (Infrastructure) — COMPLETE
Plan: 10 of 10 in Phase 0 — COMPLETE
Status: Phase 0 complete; ready to begin Phase 1 (Core Domain)
Last activity: 2026-03-15 — Phase 0 infrastructure fully verified on live VPS; all 8 smoke-test checks approved by operator

Progress: [█░░░░░░░░░] 10%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 00-infrastructure P01 | 4 | 2 tasks | 12 files |
| Phase 00-infrastructure P03 | 3 | 2 tasks | 5 files |
| Phase 00-infrastructure P02 | 5 | 2 tasks | 13 files |
| Phase 00-infrastructure P04 | 2 | 2 tasks | 9 files |
| Phase 00-infrastructure P06 | 7 | 2 tasks | 4 files |
| Phase 00-infrastructure P07 | 2 | 2 tasks | 4 files |
| Phase 00-infrastructure P05 | 2 | 2 tasks | 6 files |
| Phase 00-infrastructure P10 | checkpoint | 2 tasks | 0 files |
| Phase 00-infrastructure P11 | multi-session | 2 tasks | 4 files |
| Phase 01-auth-rbac P01 | 5 | 2 tasks | 6 files |
| Phase 01-auth-rbac P02 | 4 | 2 tasks | 11 files |
| Phase 01-auth-rbac P04 | 2 | 2 tasks | 6 files |
| Phase 01-auth-rbac PP03 | 3 | 2 tasks | 4 files |
| Phase 01-auth-rbac P05 | 5 | 2 tasks | 4 files |
| Phase 01-auth-rbac P06 | 3 | 2 tasks | 3 files |
| Phase 02-product-inventory P01 | 5 | 2 tasks | 5 files |
| Phase 02-product-inventory P02 | 2 | 2 tasks | 7 files |
| Phase 02-product-inventory P03 | 6 | 2 tasks | 8 files |
| Phase 02-product-inventory P04 | 5 | 2 tasks | 7 files |
| Phase 02-product-inventory P05 | 4 | 2 tasks | 6 files |
| Phase 02-product-inventory P06 | 8 | 1 tasks | 2 files |
| Phase 02-product-inventory P06 | 8 | 2 tasks | 2 files |
| Phase 03-pos-with-offline-mode P01 | 3 | 2 tasks | 6 files |
| Phase 03-pos-with-offline-mode P03 | 357 | 2 tasks | 4 files |
| Phase 03-pos-with-offline-mode P02 | 7 | 2 tasks | 6 files |
| Phase 03-pos-with-offline-mode P04 | 8 | 2 tasks | 6 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-Phase 0]: Monolith over microservices — single VPS, small team, domain boundaries kept clean for future extraction
- [Pre-Phase 0]: PgBouncer transaction mode — requires `postgres.js` driver or prepared statements disabled in Drizzle
- [Pre-Phase 0]: `@serwist/next` (not `next-pwa`) — only maintained PWA path for Next.js App Router
- [Pre-Phase 0]: Inventory movements are append-only — corrections via ADJUSTMENT, never UPDATE
- [Pre-Phase 0]: Accounting stub must exist in Phase 3 before full implementation in Phase 7
- [Phase 00-01]: pnpm workspace root and tsconfig created as implicit prerequisites — Rule 3 auto-fixes; both required for pnpm --filter to work
- [Phase 00-01]: Test stubs use vi.mock pattern to decouple from live services — tests run in RED state until implementation plans complete
- [Phase 00-infrastructure]: PgBouncer in TRANSACTION pool mode — requires postgres.js driver (not pg) in application layer
- [Phase 00-infrastructure]: Dev override named docker-compose.dev.yml (not override.yml) to prevent Docker auto-merging into prod runs
- [Phase 00-02]: NodeNext module resolution requires explicit .js extensions on relative imports — fixed in test stubs from plan 00-01
- [Phase 00-02]: apps/web tsconfig uses ESNext+Bundler resolution overriding base NodeNext — required by Next.js App Router
- [Phase 00-02]: apps/api set as type:module to match NodeNext ESM expectations
- [Phase 00-infrastructure]: queues.ts uses .js extension on relative import — NodeNext ESM resolution requirement
- [Phase 00-infrastructure]: db/index.ts throws at startup if DATABASE_URL missing — fail fast over silent null
- [Phase 00-infrastructure]: GPG symmetric AES256 for backup encryption — passphrase from env var, simpler than asymmetric for single-VPS
- [Phase 00-infrastructure]: rclone config written at container startup from env vars — no credentials stored in image
- [Phase 00-infrastructure]: Cron env vars explicitly written to /etc/cron.d/k21-backup — crond does not inherit shell environment
- [Phase 00-infrastructure]: Netdata netdata.conf mounted as read-only bind mount over netdataconfig named volume — ensures security config is always applied from git-tracked file
- [Phase 00-infrastructure]: verify-log-rotation.sh uses docker inspect to check live container config, not compose files — verifies what is actually running
- [Phase 00-infrastructure]: Two-phase SSL bootstrap: HTTP-only bootstrap config first, certbot issues cert, then restore HTTPS config
- [Phase 00-10]: Phase gate pattern — all Phase 0 success criteria collected into one blocking human-verify checkpoint; operator signed off on 2026-03-15 after all 8 VPS checks passed
- [Phase 00-infrastructure]: Nginx reload cron at 03:00 and 15:00 via host /etc/cron.d/k21-nginx-reload — certbot container has no docker CLI, host cron handles post-renewal reload
- [Phase 00-infrastructure]: install-vps-crons.sh called on every deploy (idempotent) — ensures cron survives VPS reprovisioning
- [Phase 01-auth-rbac]: vi.mock() without factory achieves RED state: auto-mock returns undefined exports causing import errors and is-not-a-function failures when implementation files don't exist
- [Phase 01-auth-rbac]: tsx/cjs workaround required for drizzle-kit v0.20 with NodeNext ESM — drizzle-kit CJS require() cannot resolve .js to .ts; node --require tsx/cjs intercepts correctly
- [Phase 01-auth-rbac]: audit_logs.userId has no FK — intentional: logs must survive user deletion for immutable audit trail
- [Phase 01-auth-rbac]: refresh_tokens.userId cascade delete FK — token cleanup automatic when user is deleted
- [Phase 01-auth-rbac]: authenticate uses req.path.endsWith('/auth/change-password') for mustChangePassword path check
- [Phase 01-auth-rbac]: Middleware test stubs updated from vi.mock auto-stub to real JWT signing — authenticate.test.ts and require-role.test.ts now test actual behavior
- [Phase 01-auth-rbac]: auth.test.ts auto-mock replaced with DB-layer mocks — vi.mock without factory returns vi.fn() stubs that can never pass property checks on return values
- [Phase 01-auth-rbac]: Service params use object destructuring to match existing test call sites: login({ email, password }), refresh({ token }), logout({ token })
- [Phase 01-auth-rbac]: deactivateUser accepts object param { userId, adminId?, ipAddress? } to match test call site
- [Phase 01-auth-rbac]: createUser returns { ...user, auditLog } to satisfy AUTH-08 test assertion; router strips auditLog before response
- [Phase 01-auth-rbac]: users.test.ts stubs updated to DB-layer mocks — consistent with auth.test.ts pattern, auto-mock stubs were permanently broken
- [Phase 01-auth-rbac]: No COOKIE_SECRET needed — refresh token UUID validated against DB; cookie signing adds no security value
- [Phase 01-auth-rbac]: JWT_SECRET fail-fast only in production mode — dev/test can run without it for convenience
- [Phase 02-product-inventory]: Two separate ConnectionOptions for BullMQ vs cache — bullmqRedis uses maxRetriesPerRequest: null and enableReadyCheck: false
- [Phase 02-product-inventory]: createLowStockWorker is lazy factory (not auto-instantiated) to avoid Redis connection side-effects during vitest runs
- [Phase 02-product-inventory]: REDIS_URL parsed to host/port/password fields — uses ioredis RedisOptions shape, avoids need for Redis class instance
- [Phase 02-product-inventory]: categories.parentId defined as plain uuid — self-ref FK added manually in migration SQL; Drizzle v0.30 lazy getter pattern causes TS2740 type error
- [Phase 02-product-inventory]: db:push skipped — DATABASE_URL not available in local dev; migration SQL files are the deliverable applied on deployment
- [Phase 02-product-inventory]: vi.hoisted() required for DB mock variables — vitest hoists vi.mock() factories before const declarations
- [Phase 02-product-inventory]: ppnType and categoryId validated at service layer — services called programmatically without router Zod validation
- [Phase 02-product-inventory]: db.transaction() wraps product + default variant inserts atomically in createProduct
- [Phase 02-product-inventory]: cacheRedisClient added as ioredis instance to queues/redis.ts — ConnectionOptions does not expose .get/.setex/.del; ioredis instance required for direct cache operations
- [Phase 02-product-inventory]: Drizzle sql template JSON.stringify required for FOR UPDATE test assertion — .toString() returns [object Object]; queryChunks are in JSON representation
- [Phase 02-product-inventory]: opname.service.ts signature changed from positional (counts, performedBy, approvedBy) to object param {items, performedBy, ipAddress} — matches plan 02-05 spec and test call sites
- [Phase 02-product-inventory]: processLowStockAlert extracted to lowstock.service.ts — BullMQ worker calls it; enables unit testing without BullMQ connection
- [Phase 02-product-inventory]: Mock Phase 2 routers in index.test.ts with mini routers that return 401 — avoids transitive Redis/DB connections from cacheRedisClient instantiated at module load in queues/redis.ts
- [Phase 02-product-inventory]: Mock Phase 2 routers in index.test.ts with mini routers that return 401 — avoids transitive Redis/DB connections from cacheRedisClient instantiated at module load in queues/redis.ts
- [Phase 03-pos-with-offline-mode]: Migration placed in apps/api/drizzle/ (drizzle-kit output dir) not apps/api/migrations/ as written in plan — correct path for drizzle-kit generated files
- [Phase 03-pos-with-offline-mode]: transactionItems.variantId has no FK to productVariants — cross-schema import cycle avoidance; enforced at service layer
- [Phase 03-pos-with-offline-mode]: UNIQUE constraint on transactions.client_uuid — idempotency key for offline sync deduplication
- [Phase 03-pos-with-offline-mode]: aggregateReconciliation extracted as internal helper to avoid redundant SELECT in closeShift — passes already-retrieved shift from .returning()
- [Phase 03-pos-with-offline-mode]: SHIFT_NOT_FOUND thrown for both non-existent and wrong-cashier shift close attempts — single error avoids user enumeration
- [Phase 03-pos-with-offline-mode]: completeSale uses recordMovement(params, tx) + manual UPDATE SQL — never decrementStock() which opens its own db.transaction() causing nested transaction error in PgBouncer TRANSACTION mode
- [Phase 03-pos-with-offline-mode]: pos.test.ts rewritten from vi.mock-without-factory RED stubs to DB-layer mocks — auto-mock pattern cannot make tests go GREEN; shifted to mock db + mock dependencies approach matching shifts.test.ts pattern
- [Phase 03-pos-with-offline-mode]: voidTransaction kept in pos.service.ts (tests import from there); void.service.ts re-exports it
- [Phase 03-pos-with-offline-mode]: logAudit uses action:UPDATE for void — audit_action pgEnum only supports CREATE/UPDATE/DELETE

### Research Flags (from research/SUMMARY.md)

- **Phase 3 (POS):** HIGH RISK — PWA + Serwist + Next.js App Router offline sync needs proof-of-concept spike before implementation
- **Phase 6 (Marketplace):** HIGH — Shopee and TikTok Shop APIs evolve rapidly; verify rate limits, token TTLs, webhook retry behavior before implementation
- **Phase 7 (Finance):** MEDIUM — verify current PPN rate (11% or 12%) and PKP threshold before PPN implementation
- **Phase 8 (Payroll):** HIGH — PPh 21 TER tables, BPJS ceilings, and JKK categories updated annually; verify DJP regulations before implementing tax engine

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-03-18T08:27:51.101Z
Stopped at: Completed 03-pos-with-offline-mode/03-04-PLAN.md
Resume file: None
