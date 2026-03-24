---
estimated_steps: 5
estimated_files: 5
skills_used:
  - review
  - best-practices
---

# T02: Write migration 0018, marketplace Drizzle schema, and wire listChannels() to DB

**Slice:** S01 — Schema + Foundation
**Milestone:** M001

## Description

This task delivers the core S01 contract: 5 marketplace tables in the database, the `journal_entries` FK risk resolved, Drizzle schemas that compile, and a live channels endpoint backed by a real DB query.

**Prerequisite:** T01 must be complete (migrations 0009–0017 present, `accounting.ts` is the main-repo version, marketplace module stubs exist).

**Key risks addressed:**
- `journal_entries.transaction_id` currently has a hard FK to `transactions.id` (added in migration 0010). Marketplace orders are not POS transactions. Migration 0018 drops that FK constraint, makes `transaction_id` nullable, and adds a `source_id UUID` nullable column for polymorphic reference (marketplace order ID goes here).
- The worktree's `accounting.ts` Drizzle schema (after T01 copies the main-repo version) still has `.notNull().references(() => transactions.id)` on `transactionId`. This must be changed to just `.references()` removed and the `.notNull()` dropped.

**Seed strategy:** The seed block in migration 0018 inserts one Shopee channel row and one SKU mapping row, both guarded with `ON CONFLICT DO NOTHING`. The SKU mapping's `variant_id` is conditionally inserted only if a product_variant exists in the DB (to avoid FK violation on a fresh DB install).

## Steps

1. **Write `apps/api/drizzle/0018_marketplace_schema.sql`** with 4 parts:
   - **Part A — Fix journal_entries:** Drop constraint `journal_entries_transaction_id_fk`, `ALTER COLUMN transaction_id DROP NOT NULL`, `ADD COLUMN IF NOT EXISTS source_id UUID`
   - **Part B — Marketplace enums (all with `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;` guards):** `marketplace_platform` ('SHOPEE', 'TIKTOK'), `marketplace_sync_direction` ('INBOUND_ONLY', 'BIDIRECTIONAL'), `marketplace_channel_status` ('ACTIVE', 'TOKEN_EXPIRED', 'DISCONNECTED'), `marketplace_order_status` ('UNPAID', 'READY_TO_SHIP', 'SHIPPED', 'CANCELLED', 'RETURN_REFUND'), `marketplace_sku_resolution_status` ('RESOLVED', 'UNRESOLVED', 'PARTIAL'), `marketplace_webhook_processing_status` ('PENDING', 'PROCESSED', 'FAILED', 'SKIPPED')
   - **Part C — 5 tables:** `marketplace_channels` (id, platform, shop_name, sync_direction, partner_id, shop_id, access_token, refresh_token, token_expires_at, status, created_at, updated_at), `marketplace_orders` (id, channel_id FK→marketplace_channels, order_sn UNIQUE, platform, status, buyer_name, buyer_masked_phone, total_amount NUMERIC(15,2), escrow_amount NUMERIC(15,2) nullable, platform_fee_amount NUMERIC(15,2) nullable, seller_voucher_amount NUMERIC(15,2) nullable, sku_resolution_status, created_at, updated_at), `marketplace_order_items` (id, order_id FK→marketplace_orders CASCADE, seller_sku, shopee_item_id BIGINT, shopee_model_id BIGINT, variant_id UUID nullable, item_name, qty INT, unit_price NUMERIC(15,2), line_total NUMERIC(15,2)), `marketplace_sku_mappings` (id, channel_id FK→marketplace_channels, variant_id UUID not null references product_variants, seller_sku, shopee_item_id BIGINT, shopee_model_id BIGINT, is_active BOOLEAN default true, created_at, UNIQUE(channel_id, seller_sku)), `marketplace_webhook_events` (id, channel_id FK→marketplace_channels nullable, event_type VARCHAR(100), payload JSONB, processing_status, error_message TEXT nullable, processed_at TIMESTAMPTZ nullable, created_at)
   - **Part D — Seed:** Insert one Shopee channel (id hardcoded UUID, platform SHOPEE, shop_name 'Teladan27 Motor', sync_direction INBOUND_ONLY, status DISCONNECTED, null tokens) `ON CONFLICT DO NOTHING`. Insert one SKU mapping inside `DO $$ BEGIN ... IF EXISTS (SELECT 1 FROM product_variants LIMIT 1) THEN INSERT ... ON CONFLICT DO NOTHING; END IF; END $$;`

2. **Apply the migration:** Run `psql "$DATABASE_URL" -f apps/api/drizzle/0018_marketplace_schema.sql`. Verify with `psql "$DATABASE_URL" -c "\dt marketplace_*"` (5 rows) and `psql "$DATABASE_URL" -c "\d journal_entries"` (transaction_id shows nullable, no FK listed).

3. **Write `apps/api/src/db/schema/marketplace.ts`** using Drizzle ORM, with:
   - All 6 enum declarations matching the SQL enums exactly
   - All 5 table definitions using the same column names/types as the SQL migration
   - `marketplace_order_items.variant_id` nullable (no FK reference — keep it simple, FK is in SQL only)
   - `marketplace_sku_mappings.variant_id` references `productVariants.id` from `./products.js`
   - `marketplace_channels.channel_id` FK pattern: reference using `.references(() => marketplaceChannels.id)`
   - Export all 5 `$inferSelect` and `$inferInsert` type aliases

4. **Update `apps/api/src/db/schema/accounting.ts`** — change `transactionId` from `.notNull().references(() => transactions.id)` to just the UUID column with no `.notNull()` and no `.references()`. Remove the `import { transactions } from './pos.js'` import (it is no longer used).

5. **Update `apps/api/src/db/schema/index.ts`** — add `export * from './suppliers.js'` and `export * from './marketplace.js'` at the end.

6. **Update `apps/api/src/modules/marketplace/marketplace.service.ts`** — replace the `listChannels()` stub with a real Drizzle query:
   - Add imports: `import { db } from '../../db/index.js'` and `import { marketplaceChannels } from '../../db/schema/marketplace.js'`
   - Update the `Channel` interface (or replace it with the Drizzle inferred type) to match the real schema shape
   - `listChannels()`: `return db.select().from(marketplaceChannels).orderBy(marketplaceChannels.createdAt)`
   - Leave `getChannelOrders()` and `getWebhookEvents()` as stubs returning `[]` — they are not S01 scope

7. **Run typecheck:** `cd apps/api && pnpm typecheck`. Fix any type errors before marking done.

## Must-Haves

- [ ] `apps/api/drizzle/0018_marketplace_schema.sql` applies without errors against the live DB
- [ ] `psql -c "\dt marketplace_*"` returns exactly 5 rows
- [ ] `psql -c "\d journal_entries"` shows `transaction_id` is nullable and no FK constraint named `journal_entries_transaction_id_fk`
- [ ] `psql -c "SELECT id, platform FROM marketplace_channels;"` returns 1 row (the seeded Shopee channel)
- [ ] `apps/api/src/db/schema/marketplace.ts` exports `marketplaceChannels`, `marketplaceOrders`, `marketplaceOrderItems`, `marketplaceSkuMappings`, `marketplaceWebhookEvents` plus their inferred types
- [ ] `apps/api/src/db/schema/index.ts` exports both `suppliers.js` and `marketplace.js`
- [ ] `accounting.ts` no longer has `.references(() => transactions.id)` on `transactionId` and imports from `pos.js` are removed
- [ ] `cd apps/api && pnpm typecheck` exits 0

## Verification

```bash
# Tables created
psql "$DATABASE_URL" -c "\dt marketplace_*" 2>&1 | grep -c "marketplace_" | grep -q "5" && echo "TABLES OK"

# FK dropped and transaction_id nullable
psql "$DATABASE_URL" -c "\d journal_entries" 2>&1 | grep -v "journal_entries_transaction_id_fk" | grep "transaction_id" | grep -v "not null" && echo "FK OK"

# Seed present
psql "$DATABASE_URL" -c "SELECT count(*) FROM marketplace_channels;" 2>&1 | grep -q " 1" && echo "SEED OK"

# TypeScript
cd apps/api && pnpm typecheck && echo "TYPECHECK OK"
```

## Observability Impact

- Signals added/changed: `journal_entries.source_id` is now the polymorphic reference column for `MARKETPLACE_SALE` entries — S02 workers will populate this
- How a future agent inspects this: `psql "$DATABASE_URL" -c "SELECT transaction_id, source_id, source_type FROM journal_entries LIMIT 5;"` shows the separation of POS vs marketplace entries
- Failure state exposed: if migration 0018 partially applied (e.g. FK drop succeeded but tables failed), `psql "\dt marketplace_*"` will show fewer than 5 tables

## Inputs

- `apps/api/drizzle/0017_suppliers.sql` — confirms 0017 is the last migration, so next is 0018
- `apps/api/drizzle/0010_accounting_enums_fk.sql` — identifies the FK constraint name `journal_entries_transaction_id_fk` to drop
- `apps/api/src/db/schema/accounting.ts` — T01 output (main-repo version with enums); T02 makes `transactionId` nullable
- `apps/api/src/db/schema/products.ts` — needed to reference `productVariants` in marketplace.ts
- `apps/api/src/db/schema/index.ts` — T01 output (has suppliers export); T02 adds marketplace export
- `apps/api/src/modules/marketplace/marketplace.service.ts` — T01 output (stub); T02 replaces `listChannels()` with real query

## Expected Output

- `apps/api/drizzle/0018_marketplace_schema.sql` — new migration file (journal_entries fix + 5 marketplace tables + seed)
- `apps/api/src/db/schema/marketplace.ts` — new Drizzle schema file exporting all marketplace table defs and types
- `apps/api/src/db/schema/accounting.ts` — updated: `transactionId` nullable, no `.references()`, no pos.js import
- `apps/api/src/db/schema/index.ts` — updated: adds `export * from './suppliers.js'` and `export * from './marketplace.js'`
- `apps/api/src/modules/marketplace/marketplace.service.ts` — updated: `listChannels()` queries real DB
