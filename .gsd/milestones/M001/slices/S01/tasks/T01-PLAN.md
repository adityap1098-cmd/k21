---
estimated_steps: 4
estimated_files: 15
skills_used:
  - review
---

# T01: Copy missing migrations and schema files from main repo into worktree

**Slice:** S01 — Schema + Foundation
**Milestone:** M001

## Description

The milestone worktree (`C:/Users/adity/k21/.gsd/worktrees/M001`) branched from an early commit that only has migrations 0000–0008. The live database has migrations 0009–0017 applied (from the main repo's working directory), but those files are not committed to the milestone branch.

This task brings all 9 missing migration files, the updated `accounting.ts` and `suppliers.ts` schema files, and the three marketplace module stub files into the worktree so they are tracked in git. No logic changes are made — this is purely file-copying. T02 depends on these files being present before it writes migration 0018 or updates the Drizzle schemas.

## Steps

1. Copy migrations 0009–0017 from `C:/Users/adity/k21/apps/api/drizzle/` into `apps/api/drizzle/` (9 SQL files, verbatim — no edits)
2. Copy `C:/Users/adity/k21/apps/api/src/db/schema/accounting.ts` over `apps/api/src/db/schema/accounting.ts` (replaces the old stub with the main-repo version that has enums + `sourceId`)
3. Copy `C:/Users/adity/k21/apps/api/src/db/schema/suppliers.ts` into `apps/api/src/db/schema/suppliers.ts` (new file in worktree)
4. Copy the three marketplace module files from `C:/Users/adity/k21/apps/api/src/modules/marketplace/` into `apps/api/src/modules/marketplace/` (creates the directory + 3 files: `index.ts`, `marketplace.router.ts`, `marketplace.service.ts`)

## Must-Haves

- [ ] All 9 migration files (0009–0017) present in `apps/api/drizzle/`
- [ ] `apps/api/src/db/schema/accounting.ts` is the main-repo version (contains `journalSourceTypeEnum`, `accounts` table, `debitCreditEnum`, `sourceId` column)
- [ ] `apps/api/src/db/schema/suppliers.ts` exists in the worktree
- [ ] `apps/api/src/modules/marketplace/` directory contains all 3 stub files

## Verification

```bash
# Migrations present
ls apps/api/drizzle/0009_add_fk_transaction_items_variant.sql
ls apps/api/drizzle/0017_suppliers.sql

# Schema files present
grep -q "journalSourceTypeEnum" apps/api/src/db/schema/accounting.ts && echo "accounting OK"
ls apps/api/src/db/schema/suppliers.ts

# Marketplace stubs present
ls apps/api/src/modules/marketplace/marketplace.service.ts
ls apps/api/src/modules/marketplace/marketplace.router.ts
ls apps/api/src/modules/marketplace/index.ts
```

## Inputs

- `C:/Users/adity/k21/apps/api/drizzle/0009_add_fk_transaction_items_variant.sql` — migration to copy
- `C:/Users/adity/k21/apps/api/drizzle/0010_accounting_enums_fk.sql` — migration to copy
- `C:/Users/adity/k21/apps/api/drizzle/0011_mechanics_table.sql` — migration to copy
- `C:/Users/adity/k21/apps/api/drizzle/0012_add_kilometer_to_service_orders.sql` — migration to copy
- `C:/Users/adity/k21/apps/api/drizzle/0013_add_note_to_transactions.sql` — migration to copy
- `C:/Users/adity/k21/apps/api/drizzle/0014_add_name_to_users.sql` — migration to copy
- `C:/Users/adity/k21/apps/api/drizzle/0015_shift_cash_transactions.sql` — migration to copy
- `C:/Users/adity/k21/apps/api/drizzle/0016_transaction_returns.sql` — migration to copy
- `C:/Users/adity/k21/apps/api/drizzle/0017_suppliers.sql` — migration to copy
- `C:/Users/adity/k21/apps/api/src/db/schema/accounting.ts` (main repo) — updated schema to copy
- `C:/Users/adity/k21/apps/api/src/db/schema/suppliers.ts` (main repo) — new schema to copy
- `C:/Users/adity/k21/apps/api/src/modules/marketplace/index.ts` (main repo) — stub to copy
- `C:/Users/adity/k21/apps/api/src/modules/marketplace/marketplace.router.ts` (main repo) — stub to copy
- `C:/Users/adity/k21/apps/api/src/modules/marketplace/marketplace.service.ts` (main repo) — stub to copy

## Expected Output

- `apps/api/drizzle/0009_add_fk_transaction_items_variant.sql` — migration synced into worktree
- `apps/api/drizzle/0010_accounting_enums_fk.sql` — migration synced into worktree
- `apps/api/drizzle/0011_mechanics_table.sql` — migration synced into worktree
- `apps/api/drizzle/0012_add_kilometer_to_service_orders.sql` — migration synced into worktree
- `apps/api/drizzle/0013_add_note_to_transactions.sql` — migration synced into worktree
- `apps/api/drizzle/0014_add_name_to_users.sql` — migration synced into worktree
- `apps/api/drizzle/0015_shift_cash_transactions.sql` — migration synced into worktree
- `apps/api/drizzle/0016_transaction_returns.sql` — migration synced into worktree
- `apps/api/drizzle/0017_suppliers.sql` — migration synced into worktree
- `apps/api/src/db/schema/accounting.ts` — replaced with main-repo version (has enums + sourceId)
- `apps/api/src/db/schema/suppliers.ts` — new schema file
- `apps/api/src/modules/marketplace/index.ts` — stub re-export (new file in worktree)
- `apps/api/src/modules/marketplace/marketplace.router.ts` — stub router (new file in worktree)
- `apps/api/src/modules/marketplace/marketplace.service.ts` — stub service (new file in worktree)
