# Architecture Patterns

**Project:** K21 Retail ERP
**Domain:** Retail ERP — offline-capable POS, multi-channel inventory, marketplace integrations, double-entry accounting
**Researched:** 2026-03-14
**Confidence:** HIGH (derived from PRD, PROJECT.md, and established ERP/DDD architectural patterns)

---

## Recommended Architecture

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                               │
│                                                                     │
│  ┌──────────────────────┐       ┌───────────────────────────────┐  │
│  │   Admin Dashboard    │       │       POS Terminal             │  │
│  │   (Next.js SPA)      │       │   (Next.js PWA + SW)          │  │
│  │                      │       │                               │  │
│  │ - Inventory          │       │  Online: API calls            │  │
│  │ - Warehouse          │       │  Offline: IndexedDB queue     │  │
│  │ - Procurement        │       │  Reconnect: sync flush        │  │
│  │ - Finance            │       │                               │  │
│  │ - Payroll            │       └───────────────────────────────┘  │
│  │ - Analytics          │                                          │
│  └──────────────────────┘                                          │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS
                    ┌──────────▼──────────┐
                    │   Nginx (Reverse    │
                    │   Proxy + SSL)      │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────────────────────────────┐
                    │         Node.js API (Express + TS)           │
                    │         /api/v1/ (versioned)                 │
                    │                                              │
                    │  ┌─────────┐  ┌──────────┐  ┌───────────┐  │
                    │  │  Auth   │  │   Core   │  │ Webhook   │  │
                    │  │ Module  │  │ Modules  │  │ Handlers  │  │
                    │  └─────────┘  └────┬─────┘  └─────┬─────┘  │
                    │                    │               │         │
                    │         ┌──────────▼───────────────▼──────┐ │
                    │         │       Domain Event Bus           │ │
                    │         │   (in-process, function calls)   │ │
                    │         └──────────────────────────────────┘ │
                    └──────────────────┬───────────────────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
   ┌──────────▼──────────┐  ┌─────────▼──────────┐  ┌────────▼────────┐
   │  PostgreSQL          │  │  Redis              │  │  BullMQ         │
   │  (via PgBouncer)     │  │  - Stock cache      │  │  Worker Process │
   │  - Primary data      │  │  - Session store    │  │  - Marketplace  │
   │  - Audit logs        │  │  - BullMQ backing   │  │    sync jobs    │
   │  - Journal entries   │  │                     │  │  - Report jobs  │
   └─────────────────────┘  └─────────────────────┘  └─────────────────┘
```

---

## Component Boundaries

### Domain Modules (Monolith Boundary Map)

Each module owns its data, exposes a service interface, and communicates with others only through defined service calls or the accounting event hook. No module reaches into another module's database tables directly.

| Module | Owns (DB Tables) | Exposes (Service Interface) | Consumes From |
|--------|-----------------|----------------------------|---------------|
| **Auth** | users, roles, permissions, sessions | authenticate(), authorize(), getUserById() | — |
| **Product** | products, product_variants, categories | getProduct(), searchProducts(), getVariant() | — |
| **Inventory** | inventory, inventory_movements, stock_reservations | getStock(), applyMovement(), reserveStock(), releaseReservation() | Product |
| **POS** | transactions, transaction_items, shifts | createTransaction(), openShift(), closeShift(), syncOfflineBatch() | Product, Inventory, Accounting |
| **Warehouse** | warehouses, locations, picking_lists | receiveGoods(), createPickingList(), assignLocation() | Inventory |
| **Procurement** | suppliers, purchase_orders, purchase_order_items | createPO(), approvePO(), receiveGoods() | Inventory, Accounting, Warehouse |
| **Marketplace** | orders, order_items, marketplace_channels | importOrder(), syncInventory(), handleWebhook() | Inventory, Accounting |
| **Accounting** | accounts, journal_entries, journal_entry_items | recordJournal(), getTrialBalance(), generatePL() | — (receives events from all) |
| **Payroll** | employees, payroll_runs, payroll_items | calculatePayroll(), processPayroll() | Accounting |
| **Analytics** | (read-only views / materialized) | getDashboard(), generateReport() | All modules (read-only) |
| **Jobs** | (BullMQ queues in Redis) | enqueueJob(), getJobStatus() | Marketplace, Analytics |

### Communication Rules

```
Rule 1: Modules call each other's service layer ONLY — never query across table boundaries
Rule 2: Every financial transaction posts a journal entry via Accounting.recordJournal()
Rule 3: Every stock change calls Inventory.applyMovement() — never direct table writes
Rule 4: Background work is enqueued to BullMQ — never run inline in HTTP request handlers
Rule 5: Webhook handlers immediately validate, enqueue job, return 200 — no heavy logic in handler
```

---

## Data Flow

### POS Transaction (Online Mode)

```
Cashier → POST /api/v1/pos/transactions
    │
    ├─ Auth.authorize(CASHIER role)
    ├─ POS.createTransaction(items, payment)
    │     ├─ Inventory.reserveStock(items)   ← validates availability
    │     ├─ [DB] INSERT transactions + transaction_items
    │     ├─ Inventory.applyMovement(SALE, items)
    │     │     ├─ [DB] INSERT inventory_movements (append-only)
    │     │     ├─ [DB] UPDATE inventory (quantity)
    │     │     └─ Redis.set(stock:{variantId}, newQty)
    │     └─ Accounting.recordJournal(POS_SALE, amount, paymentMethod)
    │           └─ [DB] INSERT journal_entries + journal_entry_items
    │                   (e.g. DR: Cash 100k / CR: Revenue 100k)
    └─ Return transaction + receipt data
```

### POS Transaction (Offline Mode — Sync Flow)

```
[OFFLINE — Browser]
    Cashier completes sale →
    IndexedDB.append(offlineTransaction)  ← stored locally, UUID assigned
    UI shows "Saved offline" confirmation

[RECONNECTION DETECTED — Service Worker]
    navigator.onLine = true  OR  Background Sync API fires
    Service Worker reads IndexedDB queue
    POST /api/v1/pos/sync  { transactions: [...] }

[SERVER — Sync Endpoint]
    POS.syncOfflineBatch(transactions)
    │
    ├─ For each transaction (ordered by client_timestamp):
    │     ├─ Check idempotency: client_uuid already processed? → skip
    │     ├─ Check stock: was stock available at transaction_time?
    │     │     ├─ YES → apply normally (same as online flow)
    │     │     └─ NO  → flag as CONFLICT, do NOT reverse — log for review
    │     └─ Inventory.applyMovement() + Accounting.recordJournal()
    │
    └─ Return { processed: [...], conflicts: [...] }

[BROWSER — After Sync]
    Clear processed items from IndexedDB
    Display conflicts to cashier for manual resolution
```

**Key design decision:** Offline transactions are accepted optimistically on the client. Conflicts (oversell) are flagged server-side but not auto-reversed — a human reviews them. This prevents silent data loss.

### Marketplace Event Flow

```
Shopee/TikTok → POST /api/v1/webhooks/{platform}
    │
    ├─ WebhookHandler.validate(HMAC signature)  ← reject invalid immediately
    ├─ [DB] INSERT webhook_events (raw payload, status=PENDING)
    ├─ BullMQ.enqueue('marketplace.event', { webhookId, platform, event })
    └─ Return HTTP 200 immediately  ← platform won't retry if 200

[BullMQ Worker — marketplace.event job]
    │
    ├─ Load webhook_events record
    ├─ Route by event type:
    │
    │   order.created:
    │     ├─ Marketplace.importOrder(payload)
    │     │     ├─ [DB] INSERT orders + order_items
    │     │     └─ Inventory.reserveStock(items)  ← soft reserve, not deducted yet
    │     └─ Accounting.recordJournal(MARKETPLACE_SALE, amount)
    │           └─ DR: Accounts Receivable / CR: Revenue
    │
    │   order.cancelled:
    │     ├─ Marketplace.cancelOrder(orderId)
    │     │     └─ [DB] UPDATE orders SET status=CANCELLED
    │     └─ Inventory.releaseReservation(orderId)
    │           ├─ [DB] INSERT inventory_movements (RETURN or ADJUSTMENT)
    │           └─ Redis.incr(stock:{variantId})
    │
    │   order.shipped:
    │     ├─ Marketplace.updateShipment(orderId, trackingData)
    │     │     ├─ [DB] UPDATE orders SET status=SHIPPED
    │     │     └─ Inventory.applyMovement(SALE, items)  ← actual deduction
    │     └─ [No new journal — already booked at order.created]
    │
    └─ [DB] UPDATE webhook_events SET status=PROCESSED

[BullMQ — on failure]
    Retry with exponential backoff (3 attempts)
    If exhausted → status=FAILED, alert via log/notification
```

### Inventory Sync to Marketplace (Outbound)

```
Inventory.applyMovement() called (any source)
    │
    └─ After successful write:
         BullMQ.enqueue('marketplace.sync', { variantId, newQty })

[BullMQ Worker — marketplace.sync job]
    │
    ├─ Get current stock from Redis (authoritative after movement)
    ├─ Shopee API: updateStock(variantId, qty)
    └─ TikTok API: updateStock(variantId, qty)
         Retry on API failure (rate-limit aware, exponential backoff)
```

### Double-Entry Accounting Integration

Every financial event anywhere in the system calls `Accounting.recordJournal()`. This is the single choke point — no direct inserts to `journal_entries` from outside the Accounting module.

```
Transaction Source      → Journal Template Applied
─────────────────────────────────────────────────────────────────
POS Sale (cash)         → DR: Cash / CR: Revenue
POS Sale (QRIS/transfer)→ DR: Bank / CR: Revenue
Marketplace Order       → DR: Accounts Receivable / CR: Revenue
Purchase Order received → DR: Inventory Asset / CR: Accounts Payable
Supplier Payment        → DR: Accounts Payable / CR: Cash/Bank
Payroll Run             → DR: Salary Expense / CR: Cash/Bank
Stock Adjustment (loss) → DR: COGS Adjustment / CR: Inventory Asset
Refund/Return           → DR: Revenue (reversal) / CR: Cash/Bank
```

Each journal entry record stores:
- `source_type` (POS_SALE, MARKETPLACE_SALE, PURCHASE, PAYROLL, etc.)
- `source_id` (FK to originating record)
- Balanced debit/credit line items
- `created_by`, `created_at` (immutable after insert)

---

## Suggested Build Order

Build order follows dependency graph: a module cannot be built before its dependencies.

```
Phase 0: Infrastructure
    Docker Compose, Nginx, SSL, PgBouncer, Redis, CI/CD, log rotation, backup
    └─ Dependency: nothing. Foundation for everything.

Phase 1: Auth & RBAC
    JWT auth, refresh tokens, 5 roles, API versioning /api/v1/
    └─ Dependency: Phase 0 (infrastructure running)

Phase 2: Product & Inventory
    Product catalog, variant model, inventory table, inventory_movements (append-only)
    Redis stock cache, audit_logs table, low-stock alerts
    └─ Dependency: Phase 1 (auth guards all endpoints)

Phase 3: POS
    Shift management, cart, transaction, multi-payment
    PWA setup, Service Worker, IndexedDB offline queue
    Sync endpoint with idempotency + conflict detection
    Auto: inventory_movement(SALE) + journal_entry per transaction
    └─ Dependency: Phase 2 (needs product + inventory)
                   Phase 7 foundation: Accounting.recordJournal() must exist
    NOTE: Build accounting stub in Phase 3, flesh out in Phase 7

Phase 4: Warehouse
    Location hierarchy, receive goods from PO, picking list, packing
    └─ Dependency: Phase 2 (inventory), Phase 5 (purchase orders — build after)
    REORDER NOTE: Warehouse can be built after Phase 5 since it receives from POs

Phase 5: Procurement
    Supplier master, PO creation, approval workflow
    Goods receipt → inventory_movement(PURCHASE) + journal_entry
    └─ Dependency: Phase 2 (inventory), Phase 4 (warehouse locations for receiving)

Phase 6: Marketplace
    Webhook handler (validate → enqueue → 200)
    BullMQ workers for order.created/cancelled/shipped
    Outbound inventory sync job
    Shopee + TikTok API clients
    └─ Dependency: Phase 2 (inventory for reservations)
                   Phase 7 stub (journal entries for marketplace sales)

Phase 7: Finance & Accounting
    Chart of accounts, journal_entries schema
    All journal templates for all transaction sources
    P&L, Balance Sheet, Cash Flow report generators
    └─ Dependency: All prior phases (accounting integrates with all)
    NOTE: Accounting.recordJournal() stub should be available from Phase 3 forward

Phase 8: Payroll
    Employee master, payroll run, deductions (BPJS, loans)
    PPh 21 tax calculation, payslip export
    Auto journal entry on payroll run
    └─ Dependency: Phase 7 (full accounting module)

Phase 9: Analytics
    KPI dashboard (reads from existing tables)
    Background report jobs (BullMQ)
    Sales trend, margin, marketplace performance reports
    └─ Dependency: All prior phases (read-only consumer)
```

**Recommended adjusted build order:**
`0 → 1 → 2 → 3 (with accounting stub) → 5 → 4 → 6 → 7 (full) → 8 → 9`

The reason Procurement (5) comes before Warehouse (4) in this adjusted order: you need the PO model defined before warehouse receiving workflows can reference it. However, both can overlap in development if different engineers own them.

---

## Offline POS Sync Pattern (Detailed)

### Client-Side Architecture

```
Service Worker (sw.js)
    - Caches static assets (app shell) for offline rendering
    - Intercepts fetch() calls
    - When online: passes through to API
    - When offline: serves cached responses where safe

IndexedDB Schema (offline store):
    offline_transactions: {
        client_uuid: string (UUIDv4, generated client-side)
        client_timestamp: ISO8601
        shift_id: string
        items: [{variant_id, qty, unit_price}]
        payment_method: CASH | QRIS | TRANSFER
        payment_amount: number
        status: PENDING | SYNCED | CONFLICT
    }

Sync Trigger Options (in priority order):
    1. Background Sync API (navigator.serviceWorker.ready → reg.sync.register('pos-sync'))
       → Browser fires when connectivity restored, even if tab closed
    2. navigator.onLine event listener (fallback when Background Sync unavailable)
    3. Manual "Sync Now" button (last resort, user-initiated)
```

### Server-Side Sync Endpoint

```
POST /api/v1/pos/sync
Authorization: Bearer {cashier_token}
Body: { transactions: [OfflineTransaction] }

Processing:
    1. Sort by client_timestamp ascending (respect original order)
    2. For each transaction:
       a. Check idempotency table (client_uuid) — skip if already processed
       b. Validate shift_id belongs to requesting cashier
       c. Check stock levels at processing time
       d. If stock OK: apply movement + journal entry, mark SYNCED
       e. If stock insufficient: record CONFLICT (do not apply, do not reject)
    3. Insert all client_uuids into processed_sync_ids (idempotency table)
    4. Return { synced: [uuids], conflicts: [{ uuid, reason }] }

Response codes:
    200 — all processed (even if some are conflicts — conflicts are business outcomes)
    400 — malformed payload
    401 — auth failure
    Never 5xx for conflict scenarios
```

### Idempotency Key Design

```sql
CREATE TABLE pos_sync_idempotency (
    client_uuid     UUID PRIMARY KEY,
    cashier_id      UUID NOT NULL,
    synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    transaction_id  UUID REFERENCES transactions(id)  -- NULL if conflict
);
```

This table ensures that if the client retries a sync (e.g., network dropped mid-response), duplicate transactions are not applied.

---

## Marketplace Event Flow (Detailed)

### Webhook Ingestion Layer

```
Webhook URL: POST /api/v1/webhooks/shopee
             POST /api/v1/webhooks/tiktok

Handler responsibility (must complete in < 100ms):
    1. Validate HMAC signature header
       - Shopee: X-Shopee-Signature (HMAC-SHA256 of raw body)
       - TikTok: X-Tiktok-Signature (platform-specific)
    2. Parse event_type from payload
    3. INSERT into webhook_events table (raw payload stored as JSONB)
    4. BullMQ.add('marketplace.process', { webhookEventId })
    5. Return 200 OK

webhook_events table:
    id              UUID PRIMARY KEY
    platform        ENUM('shopee', 'tiktok')
    event_type      VARCHAR (order.created, order.cancelled, order.shipped)
    raw_payload     JSONB
    status          ENUM('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED')
    attempts        INTEGER DEFAULT 0
    error_message   TEXT
    received_at     TIMESTAMPTZ
    processed_at    TIMESTAMPTZ
```

### BullMQ Queue Configuration

```typescript
// Queue definitions
const queues = {
    'marketplace.process': {
        // Process marketplace webhook events
        concurrency: 3,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
    },
    'marketplace.sync': {
        // Push stock updates outbound to marketplace APIs
        concurrency: 5,  // rate-limit aware
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        rateLimiter: { max: 100, duration: 60000 }  // 100 calls/min
    },
    'reports.generate': {
        // Heavy report generation
        concurrency: 1,  // one at a time, CPU-intensive
        attempts: 2,
        removeOnComplete: 100,
        removeOnFail: 50
    }
};
```

### Conflict Handling Between Channels

When the same product sells simultaneously on POS and marketplace:

```
Scenario: 1 unit in stock. POS sells it. Marketplace order arrives 2 seconds later.

Timeline:
    T+0: POS transaction → inventory_movements INSERT (SALE, qty=-1)
         → Redis stock = 0
    T+2: Marketplace worker processes order.created
         → Inventory.reserveStock() → stock = 0 → INSUFFICIENT
         → Order saved with status=STOCK_CONFLICT
         → Alert triggered (low stock, oversell detected)
         → Marketplace.updateStock() enqueued → pushes qty=0 to platform

Outcome: Order is imported but flagged. Staff reviews and either:
    - Procures more stock and ships
    - Cancels the marketplace order
    No automatic reversal of POS transaction.
```

---

## Double-Entry Accounting Integration (Detailed)

### Integration Pattern

The Accounting module exposes a single function that all other modules call:

```typescript
// Accounting service interface (simplified)
interface AccountingService {
    recordJournal(params: {
        sourceType: JournalSourceType;  // POS_SALE | MARKETPLACE_SALE | PURCHASE | PAYROLL | ...
        sourceId: string;               // UUID of originating record
        entries: JournalLine[];         // [{accountCode, debit?, credit?}]
        notes?: string;
        postedAt?: Date;               // defaults to now()
    }): Promise<JournalEntry>;
}

type JournalLine = {
    accountCode: string;  // e.g. '1100' = Cash, '4000' = Revenue
    debit?: number;       // in lowest currency unit (cents/rupiah)
    credit?: number;
};
// Validation: sum(debits) must equal sum(credits) — enforced at service layer
```

### Chart of Accounts (Minimal for This Business)

```
ASSETS (1xxx)
    1100  Cash
    1110  Bank (BCA / BRI)
    1200  Accounts Receivable (marketplace settlements)
    1300  Inventory Asset

LIABILITIES (2xxx)
    2100  Accounts Payable (suppliers)
    2200  Tax Payable (PPh 21 withheld)

EQUITY (3xxx)
    3000  Owner Equity

REVENUE (4xxx)
    4100  POS Sales Revenue
    4200  Shopee Sales Revenue
    4300  TikTok Sales Revenue

EXPENSES (5xxx)
    5100  Cost of Goods Sold
    5200  Salary Expense
    5300  BPJS Expense
    5400  Operational Expense
```

### Journal Templates Per Transaction Source

```
POS_SALE (cash):
    DR 1100 Cash              {amount}
    CR 4100 POS Revenue       {amount}

POS_SALE (QRIS/transfer):
    DR 1110 Bank              {amount}
    CR 4100 POS Revenue       {amount}

MARKETPLACE_SALE (order.created):
    DR 1200 Accounts Rec.     {order_value}
    CR 4200/4300 Revenue      {order_value}

PURCHASE_RECEIPT (goods received):
    DR 1300 Inventory Asset   {po_value}
    CR 2100 Accounts Payable  {po_value}

SUPPLIER_PAYMENT:
    DR 2100 Accounts Payable  {payment}
    CR 1110 Bank              {payment}

PAYROLL_RUN:
    DR 5200 Salary Expense    {gross_salary}
    CR 2200 Tax Payable       {pph21_withheld}
    CR 1110 Bank              {net_salary}
```

### Integrity Enforcement

```sql
-- Constraint: journal entries must balance
CREATE OR REPLACE FUNCTION check_journal_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT SUM(debit) - SUM(credit) FROM journal_entry_items
        WHERE journal_entry_id = NEW.journal_entry_id) != 0 THEN
        RAISE EXCEPTION 'Journal entry % is not balanced', NEW.journal_entry_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Journal entries are **immutable after creation**. Corrections are made via reversal entries (a new entry that mirrors the original with debits/credits swapped), never UPDATE/DELETE.

---

## Module Directory Structure

```
src/
├── modules/
│   ├── auth/
│   │   ├── auth.service.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.routes.ts
│   │   └── auth.schema.ts          (Drizzle table defs)
│   ├── product/
│   ├── inventory/
│   │   ├── inventory.service.ts    (applyMovement, getStock, reserve)
│   │   ├── inventory.controller.ts
│   │   ├── inventory.routes.ts
│   │   └── inventory.schema.ts     (inventory, inventory_movements)
│   ├── pos/
│   │   ├── pos.service.ts          (createTransaction, syncOfflineBatch)
│   │   ├── pos.controller.ts
│   │   ├── pos.routes.ts
│   │   └── pos-sync.schema.ts      (pos_sync_idempotency)
│   ├── warehouse/
│   ├── procurement/
│   ├── marketplace/
│   │   ├── marketplace.service.ts
│   │   ├── webhook.handler.ts      (thin — validate + enqueue only)
│   │   ├── workers/
│   │   │   ├── process-event.worker.ts
│   │   │   └── sync-stock.worker.ts
│   │   └── clients/
│   │       ├── shopee.client.ts
│   │       └── tiktok.client.ts
│   ├── accounting/
│   │   ├── accounting.service.ts   (recordJournal — the choke point)
│   │   ├── reports.service.ts      (PL, balance sheet, cash flow)
│   │   └── accounting.schema.ts
│   ├── payroll/
│   └── analytics/
├── shared/
│   ├── db/                         (Drizzle instance, PgBouncer config)
│   ├── redis/                      (Redis client singleton)
│   ├── queue/                      (BullMQ queue/worker factory)
│   ├── middleware/                 (auth, rbac, error handler, rate limit)
│   └── types/                     (shared TS types across modules)
└── app.ts                          (Express app setup, route registration)
```

---

## Scalability Considerations

| Concern | At 10 users (now) | At 50 users | At 200+ users |
|---------|-------------------|-------------|---------------|
| DB connections | PgBouncer pool=20 adequate | Pool=50, same VPS | Managed DB (Supabase/Neon) |
| Redis | Single instance, adequate | Same | Redis cluster or managed |
| BullMQ workers | Same process as API | Separate worker process | Separate worker container |
| Reports | Synchronous for small sets | Always async (BullMQ) | Separate read replica |
| POS sync | Single endpoint, fast | Add queue for large batches | — |
| Marketplace sync | BullMQ handles rate limiting | Add dedicated worker thread | Multiple worker instances |

**Extraction path (if needed):** The module boundaries in `src/modules/` are designed so each module can be extracted into its own service by:
1. Moving the module directory to a new repo
2. Replacing direct service imports with HTTP/gRPC calls
3. No database schema changes needed (each module's tables are already logically isolated)

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct Cross-Module Table Access

**What:** One module importing and querying another module's Drizzle schema directly.
**Why bad:** Creates invisible coupling. Extracting to microservices later requires untangling all cross-schema queries.
**Instead:** Call the other module's service function. `inventory.service.ts` is the only code that touches `inventory_movements`.

### Anti-Pattern 2: Inline Heavy Work in Webhook Handlers

**What:** Processing marketplace orders synchronously inside the webhook HTTP handler.
**Why bad:** Marketplace platforms (Shopee, TikTok) expect a 200 response within 5 seconds. Heavy DB work causes timeouts, triggering retries and duplicate events.
**Instead:** Validate signature → store raw payload → enqueue → return 200. All logic in BullMQ worker.

### Anti-Pattern 3: Direct Journal Entry Inserts Outside Accounting Module

**What:** POS service or marketplace service writing directly to `journal_entries` table.
**Why bad:** Bypasses balance validation, breaks single source of truth for financial data, makes auditing impossible.
**Instead:** Always call `Accounting.recordJournal()`. Never bypass the service layer for financial writes.

### Anti-Pattern 4: Mutable Inventory Movements

**What:** Updating or deleting rows in `inventory_movements` to correct errors.
**Why bad:** Destroys the audit trail. The core value proposition of K21 is zero inventory discrepancy through immutable history.
**Instead:** Insert a correcting movement (ADJUSTMENT with negative quantity and mandatory reason + approver).

### Anti-Pattern 5: Sync Inventory to Marketplace in Foreground

**What:** Calling Shopee/TikTok API synchronously when inventory changes.
**Why bad:** Marketplace APIs are slow (100-500ms), can fail, and have rate limits. Blocks the API response and creates unreliable behavior.
**Instead:** Always enqueue a `marketplace.sync` BullMQ job. The job handles retries, rate limiting, and failure logging independently.

### Anti-Pattern 6: Optimistic Stock Without Reservations

**What:** Showing available stock without accounting for confirmed-but-unshipped marketplace orders.
**Why bad:** Overselling. A product showing qty=5 might have 3 units reserved for shipped marketplace orders.
**Instead:** Maintain `stock_reservations` table. Display: `available = inventory.qty - SUM(active_reservations.qty)`.

---

## Sources

- K21 PRD (K21_PRD.md) — PRD v2.1, full system specification
- K21 PROJECT.md — architecture constraints, key decisions, requirements
- Established patterns: Domain-Driven Design (Evans), ERP accounting integration patterns, PWA offline-first design (Workbox/Background Sync API), BullMQ queue design patterns
- Confidence: HIGH for all structural decisions (derived from authoritative project docs + well-established ERP architecture patterns)
