# Project Research Summary

**Project:** K21 Retail ERP
**Domain:** Retail ERP — offline-capable POS, multi-channel inventory, marketplace integrations, double-entry accounting, payroll, single-VPS monolith
**Researched:** 2026-03-14
**Confidence:** MEDIUM (stack versions require npm verification; Indonesian tax rates require regulatory verification before implementation)

## Executive Summary

K21 is a full-scope internal retail ERP for a small Indonesian business operating a physical store with Shopee and TikTok Shop marketplace channels. Experts build this class of system as a domain-modular monolith with strict module boundaries: each domain (POS, Inventory, Procurement, Marketplace, Finance, Payroll) owns its own tables and exposes only a service interface to peers. The system's defining technical challenge is the POS offline-first requirement — the POS must function without internet and sync reliably on reconnection — combined with a double-entry accounting engine that must auto-generate balanced journal entries for every financial event across all modules.

The recommended approach is Node.js + Express + TypeScript on the backend, Next.js PWA on the frontend (with `@serwist/next` for Service Worker), PostgreSQL via PgBouncer for storage, Redis + BullMQ for async work, and Drizzle ORM for type-safe queries. The marketplace integration (Shopee + TikTok Shop) has no official Node.js SDKs and must be built as custom HTTP clients with HMAC signing. No standard Node.js library exists for double-entry accounting or Indonesian PPh 21 tax calculation — both are custom domain implementations. The recommended build order follows the dependency graph: infrastructure → auth → product/inventory → POS → procurement → warehouse → marketplace → accounting → payroll → analytics.

The three existential risks are: (1) POS offline sync producing duplicate or oversold transactions if idempotency is not designed from the start, (2) marketplace webhooks being processed non-idempotently under platform retry behavior, and (3) accounting journal entries committing unbalanced due to missing synchronous debit/credit validation. All three must be addressed architecturally before their respective phases begin — they cannot be retrofitted. Additionally, the PRD has several critical gaps that must be resolved before implementation: PPN/VAT support, stock opname (physical count) workflow, void/cancel POS transactions, discount engine, and PO partial receive. These are table-stakes features whose absence will render the system unusable in production.

## Key Findings

### Recommended Stack

The backend runs on Node.js 22 LTS with Express 4.x in TypeScript strict mode, using `tsx` for dev execution and `tsup` for production builds. Database layer is PostgreSQL 16 via PgBouncer (transaction pool mode) with Drizzle ORM — the critical constraint is that PgBouncer transaction mode is incompatible with prepared statements, requiring Drizzle to be configured with the `postgres.js` driver or `pg` without prepared statements. Redis 7.2 backs BullMQ 5.x for all async work including marketplace sync, report generation, and low-stock alerts. The frontend is Next.js 14/15 with `@serwist/next` (the maintained successor to unmaintained `next-pwa`) for PWA, Dexie.js for IndexedDB offline storage, Zustand + TanStack Query for state, and shadcn/ui + Tailwind for UI components.

**Core technologies:**
- Node.js 22 LTS + Express 4 + TypeScript 5 — stable, large ecosystem, correct for this scale
- PostgreSQL 16 + PgBouncer (transaction mode) + Drizzle ORM — type-safe SQL, zero ORM overhead, critical for complex accounting queries
- `@serwist/next` + Dexie.js — the only maintained PWA path for Next.js App Router; Dexie abstracts IndexedDB for offline queue
- BullMQ 5 + Redis 7 — handles marketplace rate limiting, webhook fan-out, async report generation
- `decimal.js` — non-negotiable for financial arithmetic; JavaScript `number` floating point is unacceptable for IDR money
- Zod — TypeScript-first validation at all API boundaries including marketplace webhook payloads and environment variables
- Vitest + Playwright — test stack; Playwright doubles for E2E and offline simulation

**Critical version/configuration flags:**
- Drizzle must use `postgres.js` driver or disable prepared statements when behind PgBouncer
- Use `@serwist/next`, not `next-pwa` (unmaintained since 2022)
- Tailwind 3.x only (v4 not production-ready at knowledge cutoff)
- All versions must be verified against npm before pinning (knowledge cutoff August 2025)

### Expected Features

**Must have (table stakes for go-live):**
- Barcode scan (USB/camera) at POS
- Multi-payment: cash, QRIS (static acceptable for v1), bank transfer
- POS offline mode with auto-sync on reconnection
- Void/cancel POS transaction with mandatory reason (PRD gap — critical to add)
- Item-level and cart-level discounts (PRD gap — critical to add; without it cashiers will corrupt data)
- Shift open/close with cash reconciliation report
- Real-time stock levels with low-stock alerts
- Product variants (size, color) — Indonesian fashion retail requirement
- Stock reservation to prevent overselling on pending marketplace orders
- Stock opname (physical count reconciliation) workflow (PRD gap — significant)
- Purchase Order creation with partial receive support (PRD gap)
- Shopee + TikTok Shop order import via webhooks
- Inventory sync push to both marketplaces with idempotency
- Marketplace OAuth token lifecycle management (PRD gap — silent failure risk)
- Double-entry accounting auto-journal for all financial events
- Chart of accounts with seeded default structure
- P&L, Balance Sheet, Cash Flow reports
- PPh 21 payroll tax calculation using TER method (PMK 168/2023) — verify rates annually
- BPJS Kesehatan + Ketenagakerjaan deductions
- Payslip PDF export

**Should have (high-value differentiators):**
- WhatsApp receipt delivery (Indonesian customers prefer WhatsApp; low cost via third-party API)
- Dynamic QRIS via Midtrans/Xendit (eliminates manual confirmation; adds transaction fee)
- Marketplace payout reconciliation dashboard (major pain point; not in PRD currently)
- Bulk product upload via CSV
- Role-specific dashboards (owner sees finance; warehouse sees stock alerts; cashier sees only POS)
- Return/refund structured workflow with inventory reversal
- PPN/VAT 11% data model (build schema now even if enforcement is phase 2)
- Barcode label printing for warehouse bin identification

**Defer to v2+:**
- WhatsApp receipt delivery (nice-to-have, not blocking operations)
- Customer loyalty/points program (handle via marketplace native programs)
- Multi-store/multi-branch (explicitly out of scope; architecture supports later extraction)
- Native mobile iOS/Android app (PWA covers offline POS requirement)
- Lazada/Tokopedia integration (Shopee + TikTok first)
- Predictive demand forecasting (requires data volume and ML infra)
- Full e-Faktur PPN filing integration (scope to data capture only)

### Architecture Approach

The recommended architecture is a domain-modular monolith: one Express API, one Next.js frontend, all modules in `src/modules/` with strict boundaries enforced by convention. No module queries another module's tables directly — all cross-module communication goes through exported service functions. The Accounting module is the single choke point for all financial writes: every sale, purchase, payroll run, and return calls `Accounting.recordJournal()` which enforces the debit/credit balance invariant before committing. Inventory movements are append-only — corrections are new ADJUSTMENT records, never UPDATEs. BullMQ workers handle all marketplace API calls and report generation asynchronously; webhook handlers do nothing except validate HMAC signatures, store the raw payload, enqueue a job, and return HTTP 200.

**Major components:**
1. **Auth module** — JWT auth, 5 RBAC roles (Owner, Admin, Cashier, Warehouse, Accountant); dependency for all other modules
2. **Inventory module** — append-only `inventory_movements` log, `SELECT ... FOR UPDATE` atomic decrements, Redis stock cache, stock reservations table; the atomicity pattern established here is inherited by POS and Marketplace
3. **POS module** — shift management, transaction creation, offline sync endpoint with `client_uuid` idempotency key and server-side stock validation at sync time
4. **Marketplace module** — webhook ingestion layer (thin, returns 200 fast), BullMQ workers for event processing, marketplace API clients (Shopee + TikTok) with HMAC signing and token refresh middleware
5. **Accounting module** — `recordJournal()` service with balance assertion, immutable journal entries, journal templates per source type, financial report generators
6. **BullMQ worker process** — `marketplace.process`, `marketplace.sync` (rate-limited), `reports.generate` (concurrency=1); all background work routes through here
7. **Analytics module** — read-only consumer of all other modules' data; materialized views for dashboard performance

### Critical Pitfalls

1. **POS offline duplicate transactions** (C1) — generate `client_uuid` UUIDv4 per offline transaction; server uses `INSERT ... ON CONFLICT (client_uuid) DO NOTHING`; never dequeue IndexedDB until server returns the server-side transaction ID
2. **Inventory oversell under concurrent load** (C3) — use `SELECT ... FOR UPDATE` within a single PostgreSQL transaction for all stock decrements; never read-then-write stock from Redis without atomic Redis operations; maintain `stock_reservations` table so marketplace orders hold inventory before shipment
3. **Unbalanced double-entry journal entries** (C5) — enforce `SUM(debits) == SUM(credits)` via PostgreSQL trigger or application assertion synchronously before commit; wrap POS transaction record + inventory movement + journal entry in one PostgreSQL transaction; run nightly BullMQ reconciliation job to catch any that slipped through
4. **Marketplace webhook non-idempotency** (C4) — deduplicate on `(platform, event_id)` with a UNIQUE constraint before any processing; use `jobId: ${platform}-${event_id}` in BullMQ to prevent queue duplicates; validate HMAC signatures before deduplication
5. **Docker disk exhaustion on single VPS** (C6) — configure Docker log rotation on ALL services from Phase 0; set Netdata disk alert at 75%; set `removeOnComplete`/`removeOnFail` limits on every BullMQ queue; prune old Docker images after each CI/CD deploy

## Implications for Roadmap

Based on combined research, the build order follows hard dependencies in the architecture. The accounting stub must exist before POS (Phase 3) can generate journal entries. Inventory atomicity must be established before POS or Marketplace touch stock. Procurement (PO model) must be defined before Warehouse receiving workflows reference it.

### Phase 0: Infrastructure Foundation
**Rationale:** No other phase can run without Docker, Nginx, SSL, PostgreSQL, Redis, PgBouncer, and CI/CD. Disk management and health checks configured here prevent catastrophic failures later.
**Delivers:** Running Docker Compose stack with Nginx SSL termination, PgBouncer in transaction mode, Redis, Netdata monitoring, GitHub Actions CI/CD pipeline, automated backups
**Avoids:** Docker disk exhaustion (C6), Docker startup race condition (m4), SSL renewal failure (M5)
**Needs research:** No — Docker + Nginx + Certbot + PgBouncer are well-documented standard patterns

### Phase 1: Auth and RBAC
**Rationale:** Authentication guards every endpoint. Cannot build any business module without knowing who the caller is and what roles they hold.
**Delivers:** JWT auth with refresh tokens, 5 roles (Owner/Admin/Cashier/Warehouse/Accountant), `express-jwt` middleware, rate limiting on login
**Uses:** jsonwebtoken, bcrypt (cost >= 12), express-rate-limit, Zod for request validation
**Avoids:** Establishing PgBouncer connection pattern correctly (no prepared statements) before domain code begins (M3)
**Needs research:** No — standard JWT + RBAC is a well-documented pattern

### Phase 2: Product Catalog and Inventory
**Rationale:** Product and inventory are the data foundation that POS, Procurement, Warehouse, and Marketplace all depend on. The inventory atomicity pattern (FOR UPDATE) established here is critical and inherited by all later phases.
**Delivers:** Product + variant schema, inventory table with `current_stock` and `reserved_qty`, append-only `inventory_movements` log, Redis stock cache, stock reservations, low-stock alert jobs
**Implements:** Inventory module service interface (`applyMovement`, `getStock`, `reserveStock`, `releaseReservation`)
**Avoids:** Race condition on concurrent stock writes (C3) — the `SELECT ... FOR UPDATE` pattern must be established here
**Needs research:** No — inventory data modeling is well-understood

### Phase 3: POS with Offline Mode
**Rationale:** POS is the primary daily-use surface for the business. It is the first phase that generates real financial data and is the highest-risk implementation due to the offline sync requirement. An accounting stub must be available.
**Delivers:** Shift management, cart + transaction flow, multi-payment (cash/QRIS/bank transfer), void/cancel transactions, item/cart discounts, thermal receipt, offline queue via IndexedDB + Dexie.js, Service Worker sync via `@serwist/next`, sync endpoint with `client_uuid` idempotency, conflict detection and reporting
**Addresses:** Table-stakes features — void/cancel (PRD gap), discount engine (PRD gap)
**Avoids:** Duplicate sync transactions (C1), oversell from stale stock snapshot (C2), IndexedDB eviction (M6), timezone mismatch in shift reports (m1)
**Research flag: HIGH RISK — recommend `/gsd:research-phase` before implementation.** The PWA/Service Worker setup with Next.js App Router + Serwist requires a proof-of-concept spike before committing to full implementation. The offline sync conflict resolution strategy needs design before any code is written.

### Phase 4: Procurement
**Rationale:** Procurement defines the PO model that warehouse receiving references. Must precede Warehouse phase. Completes the inbound stock flow: PO → receive goods → inventory update → journal entry.
**Delivers:** Supplier master data, PO creation + approval workflow, partial receive support (PRD gap), goods receipt generating `PURCHASE` inventory movements and journal entries, AP tracking
**Addresses:** Partial receive gap (suppliers deliver in multiple shipments), AP aging visibility
**Avoids:** COGS missing from accounting (m3) — cost_price field must exist on products by end of this phase for Finance to use
**Needs research:** No — standard procurement/PO patterns are well-documented

### Phase 5: Warehouse
**Rationale:** Warehouse depends on the PO model (Phase 4) for goods receipt workflows and on Inventory (Phase 2) for movement recording. Can partially overlap Phase 4 if separate engineers own it.
**Delivers:** Location hierarchy (Warehouse → Zone → Rack → Bin), goods receipt from PO, picking list generation, packing workflow, stock opname (physical count) workflow (PRD gap)
**Addresses:** Stock opname gap — the physical count reconciliation workflow needed for "zero discrepancy" goal
**Needs research:** No — warehouse WMS patterns are well-documented

### Phase 6: Marketplace Integration
**Rationale:** Marketplace is the most complex external integration, with no official SDKs, HMAC-signed requests, OAuth token lifecycle management, webhook at-least-once delivery, and rate-limited outbound sync. Must come after inventory (reservations needed) and accounting stub (marketplace sale journals).
**Delivers:** Shopee + TikTok Shop webhook handlers, BullMQ workers for order.created/cancelled/shipped, outbound inventory sync (rate-limited), marketplace API clients with HMAC signing, token refresh middleware, OAuth token expiry monitoring, `marketplace_listings` mapping table, dead letter tracking
**Addresses:** Marketplace token lifecycle gap (PRD gap), order status management gap, marketplace payout reconciliation (at minimum the data model)
**Avoids:** Webhook non-idempotency (C4), token expiry silent failure (M1), inventory sync lag oversell (M2), SKU mapping failure (m2), unversioned webhook URL (m5)
**Research flag: HIGH — `/gsd:research-phase` required.** Shopee Open API v2 and TikTok Shop API evolve rapidly. Current rate limits, token TTLs, webhook retry behavior, and fulfillment model (TikTok packages) must be verified against current platform documentation before implementation. Plan 2-3 weeks per marketplace for custom HTTP client work.

### Phase 7: Finance and Accounting
**Rationale:** Full accounting depends on all transaction-generating modules existing (POS, Procurement, Marketplace). The accounting stub must be available from Phase 3 onward; Phase 7 completes the full implementation with all journal templates, reports, and the double-entry integrity enforcement.
**Delivers:** Complete chart of accounts with seeded defaults, all journal entry templates (POS sale, marketplace sale, PO receipt, supplier payment, payroll, returns, stock adjustments), balance assertion enforcement, P&L + Balance Sheet + Cash Flow report generators, nightly reconciliation job, PPN/VAT data model (capture now; enforcement in v2)
**Addresses:** COA management UI, marketplace payout reconciliation journal template, COGS entries for all sales (m3)
**Avoids:** Unbalanced journal entries going undetected (C5), missing COGS (m3)
**Research flag: MEDIUM — `/gsd:research-phase` for PPN/VAT.** The PPN rate (currently 11%) and PKP threshold must be verified against current Indonesian tax regulations. The accounting module itself follows standard double-entry patterns.

### Phase 8: Payroll
**Rationale:** Payroll is the last transactional module — it depends on the full accounting module (Phase 7) to post salary journal entries. PPh 21 TER method calculation requires Indonesian tax regulation implementation that has no library support.
**Delivers:** Employee master with tax status (TK/0, K/0–K/3), monthly payroll run, PPh 21 calculation using TER method (PMK 168/2023), BPJS Kesehatan + Ketenagakerjaan deductions with salary ceilings, loan/advance deductions, payslip PDF export, monthly payroll journal entries
**Addresses:** All Indonesian compliance requirements for payroll
**Research flag: HIGH — `/gsd:research-phase` required.** PPh 21 TER tables, BPJS rate ceilings, and JKK risk categories change annually. Must verify current DJP regulations before implementing the tax calculation engine. Budget 3-4 weeks for the accounting engine + tax calculation combined.

### Phase 9: Analytics and Reporting
**Rationale:** Analytics is a read-only consumer of all other modules. It has no dependencies other than data existing. Comes last so it can read from all production data sources.
**Delivers:** KPI dashboard (revenue today/week/month by channel), sales by product/category/channel, margin/profitability by product (requires cost_price from Phase 4), stock value report, BullMQ background report generation jobs, marketplace performance comparison
**Needs research:** No — dashboard and reporting patterns are well-documented; the queries use existing tables

### Phase Ordering Rationale

- **Infrastructure before everything** — PgBouncer transaction mode constraint and Docker log rotation must be configured correctly before any code runs against the database
- **Auth before all business modules** — no module can be built without authentication middleware
- **Inventory atomicity before POS and Marketplace** — the `SELECT ... FOR UPDATE` pattern is the backbone of stock integrity; establishing it in Phase 2 means POS and Marketplace inherit a correct pattern
- **Procurement before Warehouse** — warehouse receiving workflows reference PO records; the PO data model must exist first
- **Accounting stub in Phase 3, full implementation in Phase 7** — POS cannot generate journal entries without some accounting interface; the stub satisfies the interface contract while full implementation waits until all transaction sources exist
- **Marketplace after Inventory + Accounting stub** — marketplace needs stock reservations and journal entry posting from day one of integration

### Research Flags

Phases requiring deeper research during planning (`/gsd:research-phase`):
- **Phase 3 (POS):** PWA + Service Worker + Next.js App Router + Serwist configuration is complex and fast-moving. A proof-of-concept spike for offline sync + IndexedDB conflict resolution is recommended before full implementation.
- **Phase 6 (Marketplace):** Shopee and TikTok Shop APIs evolve rapidly. Current rate limits, token TTLs, webhook retry behavior, and TikTok package-level fulfillment model must be verified from current platform docs. No official Node.js SDKs exist.
- **Phase 7 (Finance/Accounting):** PPN/VAT rate and PKP threshold require current Indonesian tax regulation verification.
- **Phase 8 (Payroll):** PPh 21 TER tables, BPJS ceilings, and JKK categories are updated annually by Indonesian regulators. Must verify current values before implementing tax calculation.

Phases with standard patterns (skip research-phase):
- **Phase 0 (Infrastructure):** Docker + Nginx + Certbot + PgBouncer + Redis are well-documented industry standards
- **Phase 1 (Auth):** JWT + RBAC with Express middleware is a solved problem with extensive documentation
- **Phase 2 (Inventory):** Append-only movement log + atomic stock updates with PostgreSQL are established patterns
- **Phase 4 (Procurement):** PO workflow with approval and partial receive is standard ERP procurement
- **Phase 5 (Warehouse):** WMS location hierarchy and goods receipt patterns are well-documented
- **Phase 9 (Analytics):** Read-only dashboard queries on existing tables; standard reporting patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core technology choices (Express, Next.js, PostgreSQL, Redis, BullMQ, Drizzle) are well-validated. Exact package versions must be verified against npm before pinning — knowledge cutoff August 2025. Serwist recommendation is HIGH confidence (confirmed maintained). |
| Features | MEDIUM-HIGH | Table stakes and PRD gaps are HIGH confidence (universal retail requirements, Indonesian compliance obligations). Indonesian tax rates (PPh 21 TER, BPJS ceilings, PPN rate) are MEDIUM — verified against training data but require regulatory confirmation before implementation. |
| Architecture | HIGH | Derived directly from PRD specifications and established ERP/DDD patterns. Module boundaries, data flow, and the monolith build order have clear dependency rationale. |
| Pitfalls | MEDIUM-HIGH | Inventory concurrency (FOR UPDATE) and double-entry integrity are HIGH confidence (mathematically and technically invariant). POS offline sync and marketplace webhook behavior are MEDIUM — platform-specific retry behavior needs current documentation validation. Docker/VPS operations are HIGH. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Package versions:** All npm package versions from training data must be verified with `npm view <package> version` before pinning in package.json. See STACK.md version verification checklist.
- **PPh 21 TER tables:** Verify current PTKP values, TER rate tables, and annual bracket thresholds against DJP regulations before Phase 8 implementation.
- **BPJS rate ceilings:** BPJS Kesehatan salary ceiling (~Rp12M/month) and JP salary ceiling (~Rp9.5M/month) change periodically. Verify current values before Phase 8.
- **PPN rate and PKP threshold:** Verify current PPN rate (11% at training cutoff, potential 12% increase was being discussed) and PKP threshold (Rp4.8B at training cutoff) before Phase 7 PPN implementation.
- **Shopee Open API v2 rate limits and token TTL:** Verify current per-endpoint rate limits, access token duration (~4h at training cutoff), and refresh token duration (~30 days) before Phase 6.
- **TikTok Shop API fulfillment model:** TikTok Shop's package-level order structure (one order may split into multiple packages) needs current API documentation review — the PRD's simple order model may require extension.
- **PRD gaps requiring resolution before roadmap:** The following features are absent from the PRD but are critical for production use — they must be added to the roadmap: void/cancel POS transaction, discount engine (item + cart level), stock opname workflow, PO partial receive, marketplace OAuth token lifecycle management, PPN/VAT data model.

## Sources

### Primary (HIGH confidence)
- `H:/AI/k21/K21_PRD.md` — full system specification, schema definitions, module requirements
- `H:/AI/k21/.planning/PROJECT.md` — architecture constraints, key decisions, deployment requirements
- PostgreSQL documentation — `SELECT ... FOR UPDATE` concurrency behavior (mathematically definitive)
- W3C IndexedDB specification — storage persistence behavior
- Double-entry accounting equation — mathematically invariant

### Secondary (MEDIUM confidence)
- Training knowledge of Shopee Open Platform API and TikTok Shop Open API (cutoff August 2025) — API structure, token behavior, rate limits
- PPh 21 TER method: PMK 168/2023 — effective January 2024 (training knowledge)
- BPJS rates: PP 44/2015 (Ketenagakerjaan), Perpres 82/2018 (Kesehatan) — training knowledge
- PPN rate 11%: PMK 62/2022 — training knowledge
- Indonesian SME ERP landscape: Moka POS, Jurnal.id, Paper.id, Accurate Online — competitive feature analysis
- BullMQ documentation patterns — queue design, retry behavior, job deduplication
- Serwist documentation — Next.js PWA, Service Worker configuration

### Tertiary (LOW confidence — verify before implementing)
- Shopee/TikTok Shop specific rate limits and exact token TTL values — subject to change by platform
- PPN rate (12% increase was under discussion at knowledge cutoff — confirm current rate)
- Annual PPh 21 PTKP values and TER tables — updated annually by Indonesian DJP

---
*Research completed: 2026-03-14*
*Ready for roadmap: yes*
