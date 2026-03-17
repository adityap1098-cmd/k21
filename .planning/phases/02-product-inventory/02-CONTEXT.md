# Phase 2: Product & Inventory - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Products with variants are catalogued and every stock movement is permanently recorded. Covers: product CRUD, variant management, category management, real-time inventory tracking with Redis cache, append-only inventory movement log (SALE/PURCHASE/TRANSFER/RETURN/ADJUSTMENT), stock reservation for confirmed orders, stock opname with auto-ADJUSTMENT, and low-stock alerts. This is the data foundation that POS, Procurement, Warehouse, and Marketplace all depend on. No POS transaction logic, no procurement workflows, no marketplace sync — those are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Variant model
- **Flexible JSONB attributes** — `product_variants` table with `attributes JSONB` column: `{"size": "M", "color": "Red"}`
- Handles arbitrary attribute types — works cleanly with Shopee/TikTok which have arbitrary option names
- Every product **always has at least one variant** — products with no size/color get an auto-created default variant with `attributes: {}`
- This means `inventory_movement` always references a `variant_id`, never a `product_id` directly — consistent throughout all downstream phases
- Each variant has **independent selling price** (`price` column on `product_variants`) — not a base-price delta
- Each variant has **cost price** (`cost_price` column on `product_variants`) — enables margin calculation in Phase 9 Analytics and COGS journal entries in Phase 7

### SKU & barcode ownership
- **SKU and barcode both live on `product_variants`** — the parent product has no SKU
- `sku` is **required** and unique across all variants
- `barcode` is **optional** (nullable) — not all products have printed barcodes; POS can search by SKU or scan barcode
- Default variant SKU is **auto-generated** by the system (e.g. slug from product name + short ID) — staff can edit after creation
- POS flow: scan barcode → find exact variant → decrement that variant's stock. Clean, unambiguous.

### Category structure
- **Two-level hierarchy**: parent category → child category (e.g. Clothing → T-Shirts)
- `categories` table with `parent_id` (nullable FK to self) — max one level of nesting enforced at application layer
- Each product belongs to **exactly one category** (`category_id` FK on `products` table)
- Category management (create, rename, delete) restricted to **Admin and Owner roles only**

### Low-stock alert delivery
- When stock drops below `low_stock_threshold`: write a record to a **`notifications` table** (user_id, type, payload, read_at) + enqueue a **BullMQ job** that creates the notification records
- `low_stock_threshold` is configured **per variant** (nullable — null means no alert for that variant)
- Notifications are sent to all users with **Owner or Admin role**
- Phase 9 Analytics dashboard reads from `notifications` table — no schema change needed to add email/push in v2

### Inventory movement design
- Append-only (pre-decided, non-negotiable) — no UPDATE or DELETE on `inventory_movements`
- Corrections go through ADJUSTMENT movement type (with required reason + approver per INV-04)
- Concurrent stock decrements use `SELECT ... FOR UPDATE` in a single PostgreSQL transaction (INV-05)
- Stock reservation: a `stock_reservations` table holds reserved qty for confirmed-but-not-shipped orders

### Claude's Discretion
- Exact Drizzle schema column names and constraints
- Redis cache key structure for real-time stock
- BullMQ job implementation for low-stock alert dispatch
- Stock opname workflow UX (batch input vs. line-by-line)
- ADJUSTMENT approval flow detail (who can approve, whether async or blocking)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/index.ts`: `v1Router` already registered — Phase 2 product/inventory routers mount directly under it
- `apps/api/src/db/schema/`: `users.ts`, `audit-logs.ts`, `refresh-tokens.ts` already exist — product/inventory schema files follow same pattern
- `apps/api/src/modules/auth/` and `modules/users/`: Established module structure (service + router + tests + index barrel) — products/ and inventory/ modules follow this exactly
- `apps/api/src/middleware/authenticate.ts` + `require-role.ts`: Already built — all product/inventory endpoints use these directly

### Established Patterns
- **Module structure**: `apps/api/src/modules/{domain}/` with `{domain}.service.ts`, `{domain}.router.ts`, `{domain}.test.ts`, `index.ts` barrel
- **TypeScript NodeNext ESM**: explicit `.js` extensions on all relative imports
- **`postgres.js` driver** (no prepared statements): Drizzle queries use postgres.js — `SELECT ... FOR UPDATE` uses Drizzle's `.for('update')` or raw SQL via `sql` template tag
- **Fail-fast env checks**: Add any new required env vars (e.g. Redis connection checks) at startup alongside existing pattern
- **Audit logging**: Every CREATE/UPDATE/DELETE writes to `audit_logs` — use the `logAudit` helper from Phase 1

### Integration Points
- `v1Router` in `apps/api/src/index.ts` — mount `productsRouter`, `categoriesRouter`, `inventoryRouter` here (Phase 2 addition)
- `inventory_movements` table created here is the central fact table that POS (Phase 3), Procurement (Phase 4), Warehouse (Phase 5), and Marketplace (Phase 6) all write to
- `stock_reservations` table created here is used by Marketplace (Phase 6) and POS offline sync (Phase 3)
- `notifications` table created here is read by Analytics dashboard (Phase 9)
- All downstream phases depend on the variant_id as the atomic unit of inventory — this decision is locked

</code_context>

<specifics>
## Specific Ideas

- Inventory movements are **append-only** — this was a core project decision made pre-Phase 0 for zero-discrepancy guarantee
- The "always one default variant" pattern means POS, Marketplace, and Warehouse all have one consistent code path — no dual-logic for "product vs. variant"
- Shopee and TikTok Shop both use per-SKU pricing and up to 2-tier options — the JSONB attributes model maps cleanly to their data structure when Phase 6 implements sync
- Cost price on variants enables: margin reporting (Phase 9), COGS journal entries (Phase 7), procurement cost tracking (Phase 4)

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-product-inventory*
*Context gathered: 2026-03-18*
