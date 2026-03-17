# Phase 3: POS with Offline Mode - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Cashiers can complete sales transactions at the counter whether or not internet is available. Covers: product search and barcode scan → cart management with discounts → multi-payment checkout → receipt generation → shift management (open/close with reconciliation) → transaction void → offline transaction queuing in IndexedDB → auto-sync on reconnect with idempotency and conflict resolution. Payment gateway integration, loyalty programs, and customer management are separate phases.

</domain>

<decisions>
## Implementation Decisions

### POS Screen Layout
- **Split-screen layout**: Left panel = product discovery; Right panel = cart + totals + payment button
- Left panel: search/scan bar at top + configurable quick-add product grid (tap tiles for frequent items) below
- Right panel: cart line items, subtotal, discount summary, total, and BAYAR/PAY button
- Everything visible at once — no navigation between product search and cart

### Cart & Discounts
- **Item-level discounts**: Tap a cart line → inline expand with quantity edit + discount field (percentage or flat Rp amount). No modal — stays in-cart.
- **Transaction-level discount**: Separate discount field on the cart totals area, applied to the whole transaction
- Both item-level and transaction-level discounts are supported and stored independently

### Payment UX
- **Cash**: Cashier enters amount tendered; system calculates and displays change due. Quick-select buttons for common denominations (Rp50k, Rp100k, Rp200k).
- **QRIS**: Manual confirmation — cashier selects QRIS, customer scans the merchant's static QR code (from bank/GoPay/etc.), cashier taps "Payment Received" to complete. No gateway API in Phase 3. Works offline.
- **Bank Transfer**: Manual confirmation — cashier records bank name and optional reference number, then manually confirms receipt. Trust-based, works offline.
- **Split payment**: Supported — customer can pay with multiple methods (e.g., Rp150k cash + Rp50k transfer). Each payment leg recorded separately.
- Payment method selection is the last step before completing the transaction.

### Offline Mode & Sync
- **PWA with `@serwist/next`** (locked from Phase 0) — Service Worker + IndexedDB
- **Product catalog cache**: Full active product + variant catalog (name, SKU, barcode, price, stock level) synced to IndexedDB. Stock shown offline is "last known" with a staleness warning.
- **Cache refresh schedule**: Full sync on shift open / page load; background refresh every 15 minutes while online.
- **Transaction queue**: Offline transactions written to IndexedDB with a `client_uuid` (idempotency key) and synced to server when connectivity returns.
- **Auto-sync on reconnect**: Service worker detects network restored → queued transactions submitted automatically in background. Cashier sees a status indicator ("Syncing 3 transactions...").
- **Stock conflict handling**: When server detects a conflict at sync time (stock went to 0 via another channel), the transaction is NOT auto-voided. It is flagged in a "Sync Issues" list. Cashier or Owner can review and either:
  - **Approve** — force-complete the transaction (stock may go negative); written to `inventory_movements` with a conflict note
  - **Void** — void the transaction with a reason
  - Either action is written to `audit_logs`

### Receipt Generation
- **Thermal print**: ESC/POS protocol via browser's **Web Serial API**. Supports 58mm and 80mm thermal printers. Faster and cleaner than browser print dialog.
- **Digital receipt**: A "Share Receipt" button after payment completion opens a pre-filled **WhatsApp URL** with receipt text. No backend required; works immediately after transaction.
- Receipt content: store name, transaction ID, date/time, cashier name, itemized list (name + qty + unit price + item discount), transaction discount, subtotal, tax (PPN if applicable), total, payment breakdown (method + amount per leg), change due (for cash), shift ID.

### Shift Management
- **One shift per cashier per session**: Each cashier opens their own shift with their own recorded cash float. No shared register shifts.
- **Open shift**: Cashier records opening cash float amount. System records shift_open timestamp, cashier ID, float amount.
- **Close shift**: Cashier counts physical cash in drawer and enters actual amount. System generates reconciliation report showing:
  - Opening float
  - Total sales per payment method (cash / transfer / QRIS)
  - Expected cash in drawer (float + cash sales)
  - Actual cash entered by cashier
  - Discrepancy amount (highlighted if non-zero)
- A cashier cannot start a new shift while one is already open.

### Transaction Void
- Void requires a mandatory reason (free text)
- Void is audit-logged (user, reason, timestamp, original transaction ID)
- Stock is restored via a new `inventory_movement(RETURN)` record — append-only pattern maintained
- Journal entry reversal created (same atomic transaction as stock restore)

### Claude's Discretion
- Quick-add grid: which products appear in the grid by default and how cashier customizes it
- ESC/POS library choice (e.g., `escpos`, `thermal-printer-encoder`)
- IndexedDB schema and version management (e.g., Dexie.js or raw IDB API)
- Exact Service Worker caching strategy (cache-first for static assets, network-first for API)
- PPN tax display logic on receipt (whether to show inclusive/exclusive)
- Exact UI for "Sync Issues" list — modal, sidebar, or dedicated page

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/modules/inventory/movement.service.ts`: `createMovement()` with `SELECT FOR UPDATE` — POS sale writes a `SALE` movement here (atomic)
- `apps/api/src/modules/inventory/reservation.service.ts`: Stock reservation logic — useful reference for offline conflict handling design
- `apps/api/src/middleware/authenticate.ts` + `require-role.ts`: Already built — POS API endpoints use `requireRole('Cashier')` directly
- `apps/api/src/modules/auth/`: JWT + session infrastructure — cashier login already works
- `audit_logs` table + `logAudit()` helper: Available for void logging and conflict resolution logging

### Established Patterns
- **Module structure**: `apps/api/src/modules/{domain}/` with `{domain}.service.ts`, `{domain}.router.ts`, `{domain}.test.ts`, `index.ts` barrel — new `pos/` and `shifts/` modules follow this
- **TypeScript NodeNext ESM**: explicit `.js` extensions on all relative imports
- **Atomic inventory**: Every stock decrement goes through `createMovement()` with `SELECT FOR UPDATE` in a single PostgreSQL transaction — POS sale must use the same pattern
- **`variant_id` as atomic unit**: POS always operates on `variant_id`, never `product_id` directly (Phase 2 lock)
- **`@serwist/next`** for PWA (Phase 0 lock) — not yet installed in `apps/web/package.json`; Phase 3 installs it

### Integration Points
- `v1Router` in `apps/api/src/index.ts` — mount `posRouter` and `shiftsRouter` here
- `inventory_movements` table: POS `SALE` movement writes here; void writes a `RETURN` movement
- `stock_reservations` table: available for offline conflict scenario reference
- `notifications` table: low-stock alerts fire during sale if stock hits threshold (already wired in Phase 2 worker)
- Phase 7 accounting: Phase 3 must create a **journal entry stub** interface — actual double-entry logic is implemented in Phase 7, but the `POST /api/v1/accounting/journal` call must be in place from Phase 3 onward (per ROADMAP dependency note)

</code_context>

<specifics>
## Specific Ideas

- QRIS and transfer are manual-confirmation only in Phase 3 — payment gateway (Midtrans/Xendit) is a future phase
- Split payment is supported because mixed cash/transfer is common in small Indonesian retail
- WhatsApp share for digital receipts reflects Indonesian customer behavior (WhatsApp as primary communication channel)
- Conflict resolution gives cashier override ability because goods may have already been handed to the customer during offline mode — auto-voiding would create a customer service problem

</specifics>

<deferred>
## Deferred Ideas

- QRIS/payment gateway integration (Midtrans, Xendit) — future phase after Phase 3
- Customer management / loyalty points — separate phase
- Online queue / booking system — separate phase

</deferred>

---

*Phase: 03-pos-with-offline-mode*
*Context gathered: 2026-03-18*
