# S01: Schema + Foundation

**Goal:** All marketplace DB tables exist in the live database with migrations applied. The `journal_entries.transaction_id` FK is dropped and the column made nullable. Drizzle schema exports all marketplace types. A real DB-backed `listChannels()` endpoint is live.

**Demo:** `psql -c "\dt marketplace_*"` shows 5 tables. `psql -c "\d journal_entries"` shows `transaction_id` nullable with no FK constraint. `cd apps/api && pnpm typecheck` exits 0. `GET /api/v1/marketplace/channels` returns the seeded Shopee channel row (not hardcoded stubs).

## Must-Haves

- Migrations 0009–0017 copied from main repo into worktree branch (unblocks correct numbering)
- Migration 0018 applies cleanly: journal_entries FK dropped + `transaction_id` nullable + `source_id` added; all 5 marketplace tables created; seed data inserted
- `apps/api/src/db/schema/marketplace.ts` exports all 5 table definitions + inferred types
- `apps/api/src/db/schema/accounting.ts` updated to match main repo (enums, `sourceId`) with `transactionId` now nullable (no `.references()`)
- `apps/api/src/db/schema/index.ts` exports `marketplace.js` and `suppliers.js`
- `apps/api/src/modules/marketplace/` stub files copied from main repo into worktree
- `listChannels()` in `marketplace.service.ts` queries the real `marketplace_channels` table via Drizzle
- `pnpm typecheck` in `apps/api` exits 0

## Proof Level

- This slice proves: contract — DB schema exists with correct shape, Drizzle types compile, one real endpoint returns DB data
- Real runtime required: yes (psql applied, typecheck, curl)
- Human/UAT required: no

## Verification

```bash
# 1. All 5 marketplace tables exist
psql "$DATABASE_URL" -c "\dt marketplace_*" | grep -c "marketplace_" | grep -qE "^5$" && echo PASS || echo FAIL

# 2. journal_entries.transaction_id is nullable, FK dropped
psql "$DATABASE_URL" -c "\d journal_entries" | grep "transaction_id" | grep -v "not null" | grep -qv "FK" && echo PASS || echo FAIL

# 3. Seeded channel exists
psql "$DATABASE_URL" -c "SELECT count(*) FROM marketplace_channels WHERE platform='shopee';" | grep -q " 1" && echo PASS || echo FAIL

# 4. TypeScript compiles
cd apps/api && pnpm typecheck && echo PASS || echo FAIL

# 5. Channels endpoint returns real data (requires running API + valid token)
# Manual: GET /api/v1/marketplace/channels returns array with at least 1 item (not hardcoded 'My Shopee Store')

# 6. Diagnostic: migration file count (failure state: fewer than 19 files means a copy was missed)
ls apps/api/drizzle/*.sql | wc -l | grep -qE "^19$" && echo PASS || echo FAIL

# 7. Diagnostic: marketplace stub files present (failure state: TypeScript import errors in router)
ls apps/api/src/modules/marketplace/index.ts apps/api/src/modules/marketplace/marketplace.router.ts apps/api/src/modules/marketplace/marketplace.service.ts && echo PASS || echo FAIL
```

## Observability / Diagnostics

- Inspection surfaces: `psql "$DATABASE_URL" -c "\d journal_entries"` to confirm FK removal; `psql "$DATABASE_URL" -c "\dt marketplace_*"` to confirm tables; `pnpm typecheck` to confirm Drizzle schema compiles
- Failure visibility: psql error messages are self-explanatory; tsc errors from Drizzle schema pin to exact line
- Redaction constraints: `source_id` is a UUID with no PII; `access_token`/`refresh_token` columns are nullable and empty in seed — no secrets in DB at this stage

## Integration Closure

- Upstream surfaces consumed: main repo's `apps/api/drizzle/0009–0017`, `apps/api/src/db/schema/accounting.ts`, `apps/api/src/db/schema/suppliers.ts`, `apps/api/src/modules/marketplace/` (three stub files)
- New wiring introduced in this slice: `export * from './marketplace.js'` added to `schema/index.ts`; `marketplace.service.ts` now imports `db` and `marketplaceChannels`
- What remains before the milestone is truly usable end-to-end: S02 (webhook receiver + order worker), S03 (order endpoints), S04 (frontend wiring)

## Tasks

- [x] **T01: Copy missing migrations and schema files from main repo into worktree** `est:30m`
  - Why: The worktree has only migrations 0000–0008 and lacks the `suppliers.ts` schema, updated `accounting.ts`, and marketplace module stubs. Migration 0018 cannot be numbered correctly until 0009–0017 are present. TypeScript won't compile until all imported schema files exist.
  - Files: `apps/api/drizzle/0009–0017 (9 files)`, `apps/api/src/db/schema/accounting.ts`, `apps/api/src/db/schema/suppliers.ts`, `apps/api/src/modules/marketplace/marketplace.service.ts`, `apps/api/src/modules/marketplace/marketplace.router.ts`, `apps/api/src/modules/marketplace/index.ts`
  - Do: Copy each file verbatim from `C:/Users/adity/k21/` (main repo) into the worktree. No edits — just bring them into the branch so git tracks them.
  - Verify: `ls apps/api/drizzle/0017_suppliers.sql` exits 0; `ls apps/api/src/modules/marketplace/marketplace.service.ts` exits 0
  - Done when: All 15 files are present in the worktree and staged for commit.

- [x] **T02: Write migration 0018, marketplace Drizzle schema, and wire listChannels() to DB** `est:1h`
  - Why: This is the core S01 deliverable — creates all 5 marketplace tables, resolves the journal_entries FK risk, and proves the schema is real by returning live data from the channels endpoint.
  - Files: `apps/api/drizzle/0018_marketplace_schema.sql`, `apps/api/src/db/schema/marketplace.ts`, `apps/api/src/db/schema/accounting.ts`, `apps/api/src/db/schema/index.ts`, `apps/api/src/modules/marketplace/marketplace.service.ts`
  - Do: Write migration 0018 (journal_entries FK drop + nullable + source_id, marketplace enums, 5 tables, seed). Write `marketplace.ts` schema file. Update `accounting.ts` to make `transactionId` nullable with no `.references()`. Add `export * from './marketplace.js'` to `index.ts`. Replace `listChannels()` stub with a real `db.select().from(marketplaceChannels)` query.
  - Verify: `psql "$DATABASE_URL" -f apps/api/drizzle/0018_marketplace_schema.sql` succeeds; `cd apps/api && pnpm typecheck` exits 0
  - Done when: 5 marketplace tables exist in DB, typecheck passes, `GET /api/v1/marketplace/channels` returns the seeded Shopee channel row.

## Files Likely Touched

- `apps/api/drizzle/0009_add_fk_transaction_items_variant.sql`
- `apps/api/drizzle/0010_accounting_enums_fk.sql`
- `apps/api/drizzle/0011_mechanics_table.sql`
- `apps/api/drizzle/0012_add_kilometer_to_service_orders.sql`
- `apps/api/drizzle/0013_add_note_to_transactions.sql`
- `apps/api/drizzle/0014_add_name_to_users.sql`
- `apps/api/drizzle/0015_shift_cash_transactions.sql`
- `apps/api/drizzle/0016_transaction_returns.sql`
- `apps/api/drizzle/0017_suppliers.sql`
- `apps/api/drizzle/0018_marketplace_schema.sql`
- `apps/api/src/db/schema/accounting.ts`
- `apps/api/src/db/schema/suppliers.ts`
- `apps/api/src/db/schema/marketplace.ts`
- `apps/api/src/db/schema/index.ts`
- `apps/api/src/modules/marketplace/marketplace.service.ts`
- `apps/api/src/modules/marketplace/marketplace.router.ts`
- `apps/api/src/modules/marketplace/index.ts`
