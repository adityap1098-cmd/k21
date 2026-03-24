# Roadmap: K21 Retail ERP

## Overview

K21 is built from the ground up as a domain-modular monolith on a single VPS. The build order follows hard architectural dependencies: infrastructure runs first so every subsequent phase has a stable foundation; auth gates every endpoint; inventory atomicity is established early so POS and Marketplace inherit a correct concurrency pattern; procurement precedes warehouse because receiving workflows reference PO records; accounting exists as a stub from Phase 3 onward and completes in Phase 7 after all transaction sources are live; payroll posts to the completed accounting engine; analytics reads everything last. Completing all ten phases delivers a fully integrated retail ERP with zero inventory discrepancy as its defining invariant.

## Phases

**Phase Numbering:**
- Integer phases (0–9): Planned milestone work
- Decimal phases (e.g., 3.1): Urgent insertions between integers (marked INSERTED)

- [x] **Phase 0: Infrastructure** - Deploy the Docker Compose stack with SSL, databases, monitoring, CI/CD, and encrypted backups
- [x] **Phase 1: Auth & RBAC** - Users can authenticate and every endpoint is protected by role-based access control (completed 2026-03-17)
- [x] **Phase 2: Product & Inventory** - Products with variants are catalogued and every stock movement is recorded in an immutable append-only log (completed 2026-03-17)
- [x] **Phase 3: POS with Offline Mode** - Cashiers can transact at the counter with or without internet connectivity (completed 2026-03-18)
- [ ] **Phase 4: Procurement** - Purchase Orders flow from creation through approval to goods receipt, updating inventory atomically
- [ ] **Phase 5: Warehouse Management** - Goods are received into a physical location hierarchy and picked/packed for outbound orders
- [ ] **Phase 6: Marketplace Integration** - Orders from Shopee and TikTok Shop are imported and inventory stays synchronised across all channels
- [ ] **Phase 7: Finance & Accounting** - Every financial event across all modules auto-generates balanced double-entry journal entries and financial reports
- [ ] **Phase 8: Payroll** - Monthly payroll is calculated with Indonesian PPh 21 TER method and BPJS deductions and posted to accounting
- [ ] **Phase 9: Analytics** - Real-time KPI dashboard and background-generated reports give the owner full operational visibility

## Phase Details

### Phase 0: Infrastructure
**Goal**: A production-grade Docker Compose stack is running on VPS — the foundation every other phase builds on
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, INFRA-08
**Success Criteria** (what must be TRUE):
  1. HTTPS site is reachable at the domain with a valid Let's Encrypt certificate that auto-renews
  2. Pushing to main branch triggers an automated deploy that reaches the VPS without manual intervention
  3. PostgreSQL is accessible only through PgBouncer in transaction mode; Redis and BullMQ queues are operational
  4. An encrypted backup of the database is uploaded to Backblaze B2 each night and backups older than 7 days are automatically deleted
  5. Netdata dashboard (localhost only) shows CPU/RAM/Disk metrics and Docker log rotation is active on every service
**Plans**: 11 plans

Plans:
- [x] 00-01-PLAN.md — Wave 0: Vitest config + test stubs (DB, Queue, Health) + backup dry-run + smoke test scripts
- [x] 00-02-PLAN.md — Wave 1: pnpm monorepo scaffold (@k21/shared, @k21/api, @k21/web stubs, .env.example)
- [x] 00-03-PLAN.md — Wave 1: Docker Compose base + prod override + dev override + PgBouncer config
- [x] 00-04-PLAN.md — Wave 1: Express API skeleton (health endpoint, DB client, BullMQ queues, Dockerfiles)
- [x] 00-05-PLAN.md — Wave 2: Nginx HTTPS config + SSL bootstrap script (two-phase certbot)
- [x] 00-06-PLAN.md — Wave 2: Backup container (GPG + rclone + B2 upload + 7-day retention)
- [x] 00-07-PLAN.md — Wave 2: Netdata localhost-only config + log rotation verification script
- [x] 00-08-PLAN.md — Wave 3: GitHub Actions CI/CD pipeline (lint → typecheck → test → deploy)
- [x] 00-09-PLAN.md — Wave 3: Backup restore script + disaster recovery runbook
- [x] 00-10-PLAN.md — Wave 4: VPS smoke-test checkpoint (final human verification of all INFRA-XX criteria)
- [ ] 00-11-PLAN.md — Gap closure Wave 1: certbot nginx reload cron + restore drill documentation

### Phase 1: Auth & RBAC
**Goal**: Every user can log in securely and every API endpoint enforces the correct role permissions
**Depends on**: Phase 0
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08
**Success Criteria** (what must be TRUE):
  1. User can log in with email and password and receive a short-lived JWT access token plus a refresh token
  2. User can refresh their session without re-entering credentials and can log out to invalidate the session
  3. An Admin can create a new user, assign a role, and deactivate that user — and the user immediately loses access
  4. Accessing an endpoint without the required role returns HTTP 403; all endpoints are under the `/api/v1/` prefix
  5. Every CREATE, UPDATE, and DELETE action on protected resources writes a record to `audit_logs` with user ID, action, before/after values, IP, and timestamp
**Plans**: 6 plans

Plans:
- [ ] 01-01-PLAN.md — Wave 0: Install auth packages (jose, argon2, cookie-parser, zod) + create test stubs (RED state)
- [ ] 01-02-PLAN.md — Wave 1: Drizzle schema (users, refresh_tokens, audit_logs tables + enums) + migration
- [ ] 01-03-PLAN.md — Wave 2: Auth service (login/refresh/logout) + auth router (POST /login, /refresh, /logout)
- [ ] 01-04-PLAN.md — Wave 2: authenticate middleware + requireRole factory + logAudit helper + Express type augmentation
- [ ] 01-05-PLAN.md — Wave 3: Users module (createUser/updateUser/deactivateUser service + Admin-only router)
- [ ] 01-06-PLAN.md — Wave 4: Wire all modules into index.ts + AUTH-07 integration tests + full suite GREEN

### Phase 2: Product & Inventory
**Goal**: Products with variants are catalogued and every stock movement is permanently recorded — the data foundation for POS, Procurement, Warehouse, and Marketplace
**Depends on**: Phase 1
**Requirements**: PROD-01, PROD-02, PROD-03, INV-01, INV-02, INV-03, INV-04, INV-05, INV-06, INV-07, INV-08
**Success Criteria** (what must be TRUE):
  1. User can create a product with name, SKU, barcode, category, price, PPN classification, and multiple variants (size/color) each with independent stock
  2. Every stock change — regardless of source — generates an immutable `inventory_movement` record; no existing movement record can be edited or deleted
  3. Concurrent stock decrements use `SELECT ... FOR UPDATE` in a single PostgreSQL transaction — two simultaneous sales cannot both succeed when only one unit remains
  4. Confirmed orders hold stock via a reservation; the reservation prevents that stock from being sold elsewhere until the order is fulfilled or cancelled
  5. When stock falls below a configured threshold, an automated low-stock alert fires; a staff member can run a stock opname (physical count) and the system auto-generates ADJUSTMENT movements for any discrepancy
**Plans**: 6 plans

Plans:
- [ ] 02-01-PLAN.md — Wave 1: Redis client + BullMQ low-stock queue + test stubs in RED state
- [ ] 02-02-PLAN.md — Wave 2: Drizzle schema (categories, products, product_variants, inventory_movements, stock_reservations, notifications) + migration
- [ ] 02-03-PLAN.md — Wave 3: Categories module + Products module (service + router + tests GREEN)
- [ ] 02-04-PLAN.md — Wave 3: Inventory core (stock cache, movement service with FOR UPDATE, reservation service)
- [ ] 02-05-PLAN.md — Wave 4: Opname service + low-stock worker + inventory router
- [ ] 02-06-PLAN.md — Wave 5: Wire all modules into index.ts + full suite GREEN + human checkpoint

### Phase 3: POS with Offline Mode
**Goal**: Cashiers can complete sales transactions at the counter whether or not the internet is available, and offline transactions sync to the server reliably without duplicates
**Depends on**: Phase 2 (full), Phase 7 (accounting stub for journal entry interface)
**Requirements**: POS-01, POS-02, POS-03, POS-04, POS-05, POS-06, POS-07, POS-08, POS-09, POS-10, POS-11
**Success Criteria** (what must be TRUE):
  1. Cashier can scan a barcode or search by name to add items to a cart, adjust quantities, apply item-level discounts, and complete a sale with cash, bank transfer, or QRIS payment
  2. A completed transaction produces a printable and digital receipt and decrements stock and generates a journal entry in one atomic database transaction
  3. Cashier can open a shift, record cash float, and close the shift to produce a reconciliation report showing total sales and any cash discrepancy
  4. Cashier can void a completed transaction with a mandatory reason; the void is recorded in the audit log and stock is restored
  5. When the browser has no internet, the POS continues to function — transactions are queued in IndexedDB; when connectivity returns they auto-sync to the server without creating duplicates (idempotency via `client_uuid`); stock conflicts detected at sync time are flagged for cashier resolution
**Plans**: 8 plans

Plans:
- [ ] 03-01-PLAN.md — Wave 0: Drizzle schema (shifts, transactions, transaction_items, transaction_payments, journal_entries stub) + migration SQL + RED test stubs
- [ ] 03-02-PLAN.md — Wave 1: Accounting stub service (createJournalEntryStub) + POS sale service (completeSale, syncOfflineTx) — atomic transaction POS-11
- [ ] 03-03-PLAN.md — Wave 1: Shifts module (openShift, closeShift, reconciliation) — parallel with 03-02
- [ ] 03-04-PLAN.md — Wave 2: Void service + POS router (POST /transactions, /sync, /:id/void) + wire posRouter + shiftsRouter into index.ts
- [ ] 03-05-PLAN.md — Wave 3: Install @serwist/next + Dexie offline DB + Zustand cart/shift stores + sync manager
- [ ] 03-06-PLAN.md — Wave 4: POS split-screen UI — ProductPanel (search + barcode + quick-add) + CartPanel (inline editor + totals)
- [ ] 03-07-PLAN.md — Wave 4: Payment + Receipt — PaymentModal (cash change + QRIS + transfer + split) + ReceiptModal (ESC/POS + WhatsApp) — parallel with 03-06
- [ ] 03-08-PLAN.md — Wave 5: ShiftDrawer + SyncStatusBar + SyncIssuesPanel + full POS page wiring + human checkpoint

### Phase 4: Procurement
**Goal**: The full inbound purchasing workflow — from PO creation through supplier approval to goods receipt — is operational and inventory is updated atomically on receipt
**Depends on**: Phase 2
**Requirements**: PROC-01, PROC-02, PROC-03, PROC-04, PROC-05
**Success Criteria** (what must be TRUE):
  1. A staff member can create a Purchase Order listing a supplier, items, and quantities; the PO requires Owner or Admin approval before it is sent to the supplier
  2. Warehouse staff can record a goods receipt against an approved PO, including partial deliveries across multiple shipments
  3. Each goods receipt automatically generates a `PURCHASE` inventory movement that increments stock; when all ordered quantities are received, the PO is automatically marked fully received
**Plans**: TBD

### Phase 5: Warehouse Management
**Goal**: Goods move through a physical location hierarchy from receiving dock to outbound packing, and every location assignment is tracked
**Depends on**: Phase 4
**Requirements**: WH-01, WH-02, WH-03, WH-04
**Success Criteria** (what must be TRUE):
  1. An admin can define a warehouse location hierarchy (Warehouse → Zone → Rack → Bin) and assign products to specific bin locations
  2. Warehouse staff can receive goods from an approved Purchase Order and assign each item to a physical bin location
  3. The system generates a picking list for an outbound order; warehouse staff can execute a packing workflow before goods leave the warehouse
**Plans**: TBD

### Phase 6: Marketplace Integration
**Goal**: Orders from Shopee and TikTok Shop are automatically imported and inventory stays synchronised across all channels without manual intervention
**Depends on**: Phase 2, Phase 3 (accounting stub must exist for marketplace sale journals)
**Requirements**: MKT-01, MKT-02, MKT-03, MKT-04, MKT-05, MKT-06, MKT-07, MKT-08
**Success Criteria** (what must be TRUE):
  1. A new order created on Shopee or TikTok Shop appears in K21 within the webhook delivery window — the webhook handler returns HTTP 200 in under 100ms and the order is enqueued for processing
  2. When a marketplace order is confirmed, stock is reserved; when it is cancelled, the reservation is released; when it is shipped, the reservation converts to an `inventory_movement(SALE)` and a journal entry
  3. Stock levels in K21 are pushed to Shopee and TikTok Shop automatically as inventory changes — overselling is prevented by the reservation system
  4. Duplicate webhook events (same platform + event type + event ID) are discarded before processing via a UNIQUE constraint
  5. OAuth tokens for each marketplace are refreshed automatically before they expire — marketplace sync never stops due to a stale token
**Plans**: 10 plans

Plans:
- [ ] 06-01-PLAN.md — Wave 0: Drizzle schema (marketplace_tokens, webhook_events, marketplace_orders, marketplace_order_items, marketplace_listings) + migration SQL + RED test stubs
- [ ] 06-02-PLAN.md — Wave 1: Shopee + TikTok HTTP clients (HMAC-SHA256 signing) + token management service + BullMQ token refresh worker
- [ ] 06-03-PLAN.md — Wave 2: Webhook handlers (POST /webhooks/shopee, /webhooks/tiktok) — HMAC verify, store raw, enqueue, return 200 < 100ms, dedup via UNIQUE constraint
- [ ] 06-04-PLAN.md — Wave 3: Order import workers — process webhook events, normalize payload, create marketplace_orders, map SKU via marketplace_listings, reserve stock
- [ ] 06-05-PLAN.md — Wave 3: Order lifecycle workers — cancel releases reservation, ship converts to inventory_movement(SALE) + journal entry, complete finalizes
- [ ] 06-06-PLAN.md — Wave 4: Outbound stock sync — inventory changes trigger debounced BullMQ job that pushes stock to Shopee + TikTok via marketplace_listings bridge
- [ ] 06-07-PLAN.md — Wave 4: Polling fallback — BullMQ cron every 5 min polls order list as safety net for missed webhooks
- [ ] 06-08-PLAN.md — Wave 5: Marketplace API endpoints — OAuth authorize/callback, channel management, listing CRUD, order/webhook list endpoints
- [ ] 06-09-PLAN.md — Wave 6: Marketplace frontend — channel connection UI, orders tab, SKU mapping page, webhook events log
- [ ] 06-10-PLAN.md — Wave 7: Full suite verification + human checkpoint (all MKT-01..08 coverage)

### Phase 7: Finance & Accounting
**Goal**: Every financial event across all modules automatically produces balanced double-entry journal entries, and the owner can generate P&L, Balance Sheet, and Cash Flow reports at any time
**Depends on**: Phase 3, Phase 4, Phase 6 (all transaction sources must exist before completing the full accounting implementation)
**Requirements**: FIN-01, FIN-02, FIN-03, FIN-04, FIN-05, FIN-06, FIN-07, FIN-08, FIN-09
**Success Criteria** (what must be TRUE):
  1. Every financial event — POS sale, marketplace sale, purchase order receipt, supplier payment, payroll run — automatically produces a balanced journal entry; the system rejects any entry where debits do not equal credits before the PostgreSQL transaction commits
  2. Owner or Finance user can configure the Chart of Accounts via UI; a default COA is seeded on first setup
  3. Finance user can generate a Profit & Loss report, Balance Sheet, and Cash Flow Statement for any date range, filtered by channel (POS / Shopee / TikTok Shop) or product
  4. Generating a large report runs as a BullMQ background job — the browser never times out waiting for it
**Plans**: TBD

### Phase 8: Payroll
**Goal**: Finance can run monthly payroll with correct Indonesian PPh 21 TER calculation and BPJS deductions, producing payslips and posting salary journal entries automatically
**Depends on**: Phase 7
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06
**Success Criteria** (what must be TRUE):
  1. Finance user can configure salary components per employee (base salary, bonus, allowances) and record loan deductions
  2. Running monthly payroll calculates PPh 21 using the TER method (PMK 168/2023) and deducts correct BPJS Kesehatan and Ketenagakerjaan amounts per current regulatory ceilings
  3. Each employee's payslip is generated as a downloadable PDF showing gross pay, all deductions, and net pay
  4. Completing a payroll run automatically posts a journal entry (Debit: Salary Expense / Credit: Cash) to accounting
**Plans**: TBD

### Phase 9: Analytics
**Goal**: The owner and relevant staff can see real-time KPI dashboards and generate detailed sales and marketplace performance reports
**Depends on**: Phase 7 (financial data), Phase 6 (marketplace data), Phase 2 (inventory data)
**Requirements**: ANL-01, ANL-02, ANL-03, ANL-04
**Success Criteria** (what must be TRUE):
  1. The dashboard shows today's revenue, gross margin, and critical stock alerts in real time — data refreshes without a full page reload
  2. User can view sales trend charts broken down by product and by channel (POS / Shopee / TikTok Shop) for any date range
  3. User can view marketplace performance metrics — order volume and cancellation rate — per platform
  4. Requesting a large report (e.g., full-year sales by product) queues a BullMQ job; the user is notified when the report is ready and can download it without the browser having timed out
**Plans**: TBD

## Progress

**Execution Order (revised 2026-03-22):**
0 → 1 → 2 → 3 → 6 → 7 → 8 → 9 → 4 → 5
(Procurement/Warehouse deferred — backend complete, UI later; Marketplace prioritized for business value)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Infrastructure | 11/11 | Complete   | 2026-03-17 |
| 1. Auth & RBAC | 6/6 | Complete   | 2026-03-17 |
| 2. Product & Inventory | 6/6 | Complete   | 2026-03-17 |
| 3. POS with Offline Mode | 8/8 | Complete    | 2026-03-18 |
| 4. Procurement | backend done | Deferred (UI later) | - |
| 5. Warehouse Management | 0/TBD | Deferred | - |
| 6. Marketplace Integration | 0/10 | **Next** | - |
| 7. Finance & Accounting | 0/TBD | Not started | - |
| 8. Payroll | 0/TBD | Not started | - |
| 9. Analytics | 0/TBD | Not started | - |
