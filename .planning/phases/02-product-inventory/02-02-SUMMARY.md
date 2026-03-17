---
phase: 02-product-inventory
plan: "02"
subsystem: database-schema
tags: [drizzle, schema, postgres, migration, categories, products, inventory, notifications]
dependency_graph:
  requires:
    - 02-01  # Redis/BullMQ queue infrastructure
  provides:
    - categories table
    - products table
    - productVariants table
    - inventoryMovements table
    - stockReservations table
    - notifications table
    - ppnEnum, movementTypeEnum, reservationStatusEnum
  affects:
    - 02-03  # product service layer imports from these schema files
    - 02-04  # inventory service layer imports from these schema files
    - 02-05  # notification service imports notifications table
tech_stack:
  added: []
  patterns:
    - Drizzle ORM pgTable definitions with typed inference
    - pgEnum for domain-constrained columns
    - Self-referencing FK via manual migration SQL (Drizzle v0.30 limitation)
    - Append-only table pattern (inventoryMovements has no updatedAt)
    - jsonb for flexible variant attributes
key_files:
  created:
    - apps/api/src/db/schema/categories.ts
    - apps/api/src/db/schema/products.ts
    - apps/api/src/db/schema/inventory.ts
    - apps/api/src/db/schema/notifications.ts
    - apps/api/drizzle/0001_overrated_phil_sheldon.sql
    - apps/api/drizzle/meta/0001_snapshot.json
  modified:
    - apps/api/src/db/schema/index.ts
decisions:
  - "categories.parentId defined as plain uuid — self-ref FK added manually in migration SQL; Drizzle v0.30 lazy getter pattern causes TS2740 type error"
  - "db:push skipped — DATABASE_URL not available in local dev; migration SQL files are the deliverable and will be applied on deployment"
metrics:
  duration: "2 minutes"
  completed_date: "2026-03-17"
  tasks_completed: 2
  files_changed: 7
---

# Phase 02 Plan 02: Drizzle Schema — Product, Inventory, Notifications Summary

**One-liner:** Five new Drizzle schema tables (categories, products, product_variants, inventory_movements, stock_reservations, notifications) with enums, migration SQL, and schema index re-exports.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create schema files — categories, products, inventory, notifications | 14acb39 | categories.ts, products.ts, inventory.ts, notifications.ts, index.ts |
| 2 | Generate Drizzle migration and push to database | 1cc9fdd | 0001_overrated_phil_sheldon.sql, meta/0001_snapshot.json, meta/_journal.json |

## What Was Built

### Schema Files

**categories.ts** — Self-referencing category tree. `parentId` is a plain uuid (no Drizzle-level FK due to v0.30 limitation; FK enforced in migration SQL).

**products.ts** — `ppnEnum` (`TAXABLE`/`NON_TAXABLE`) + `products` table (categoryId FK, ppnType, isActive, createdBy) + `productVariants` table (sku unique, barcode unique, jsonb attributes, numeric price/costPrice, stockQty, lowStockThreshold).

**inventory.ts** — `movementTypeEnum` (`SALE`/`PURCHASE`/`TRANSFER`/`RETURN`/`ADJUSTMENT`) + `inventoryMovements` (append-only, no updatedAt) + `reservationStatusEnum` (`ACTIVE`/`FULFILLED`/`CANCELLED`) + `stockReservations`.

**notifications.ts** — Notifications table with userId cascade FK to users.

**schema/index.ts** — Updated to re-export all four new schema modules alongside existing users/refresh-tokens/audit-logs.

### Migration

`drizzle/0001_overrated_phil_sheldon.sql` — Creates all 5 new tables and 3 new enum types. Manually appended self-ref FK for `categories.parent_id`. All FK constraints wrapped in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object` pattern consistent with existing migration.

## Verification Results

- TypeScript: zero errors in schema files (`pnpm --filter @k21/api typecheck` — errors present only in pre-existing test stubs for unimplemented modules)
- Migration SQL: 2 SQL files exist in `apps/api/drizzle/`
- All required exports present: `Category`, `Product`, `ProductVariant`, `VariantAttributes`, `InventoryMovement`, `StockReservation`, `Notification`, `ppnEnum`, `movementTypeEnum`, `reservationStatusEnum`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Self-referencing FK causes TS2740 type error**
- **Found during:** Task 1 typecheck
- **Issue:** `categories.id as any` in lazy getter pattern generates `PgUUIDBuilder` type incompatible with `PgColumn` — Drizzle v0.30 does not support self-ref FK in schema definition
- **Fix:** Removed `.references()` from `parentId`, kept it as plain `uuid('parent_id')`. Added self-ref FK `ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk"` manually to the generated migration SQL (as documented in plan fallback instructions)
- **Files modified:** `apps/api/src/db/schema/categories.ts`, `apps/api/drizzle/0001_overrated_phil_sheldon.sql`
- **Commit:** 14acb39 (schema), 1cc9fdd (migration)

**2. [Expected] db:push skipped — no DATABASE_URL**
- This is documented in plan as best-effort. Migration SQL files are the deliverable.

## Self-Check: PASSED

- FOUND: apps/api/src/db/schema/categories.ts
- FOUND: apps/api/src/db/schema/products.ts
- FOUND: apps/api/src/db/schema/inventory.ts
- FOUND: apps/api/src/db/schema/notifications.ts
- FOUND: apps/api/drizzle/0001_overrated_phil_sheldon.sql
- FOUND: task1 commit 14acb39
- FOUND: task2 commit 1cc9fdd
