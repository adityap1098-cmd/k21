# Feature Landscape

**Domain:** Retail ERP — Small Indonesian retail business, physical store + online marketplace
**Project:** K21 Retail ERP
**Researched:** 2026-03-14
**Confidence note:** WebSearch and WebFetch tools were unavailable in this session. All findings draw from training knowledge (cutoff August 2025). Indonesian tax rules (PPh 21, BPJS) and marketplace API capabilities are flagged with confidence levels.

---

## Table Stakes

Features users expect in a retail ERP. Missing any of these and the system feels broken or users will revert to manual workarounds.

### POS Module

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Barcode scan (USB/camera) | Every modern POS has it; cashiers refuse to type SKUs | Low | PRD covers this |
| Cart management (add/edit/remove) | Core transactional UI | Low | PRD covers this |
| Multi-payment: cash + QRIS + bank transfer | Indonesian retail reality — QRIS is mandated widely, bank transfer is common for larger purchases | Medium | PRD covers this; QRIS requires midtrans/xendit or static QRIS sticker (static sticker = no confirmation needed, but also no amount validation) |
| Receipt: thermal print + WhatsApp/email digital | Thermal print is table stakes; WhatsApp receipt is increasingly expected in Indonesian SME retail | Medium | PRD has print + digital but WhatsApp delivery is a gap — see gap analysis below |
| Shift open/close with cash drawer reconciliation | Owner needs to know if cash matches; without this, cashier accountability is zero | Medium | PRD covers shift management but reconciliation detail is implicit |
| Offline mode with auto-sync | Indonesian retail has unreliable internet; POS stopping = business stopping | High | PRD explicitly covers this — correctly flagged as critical |
| Void/cancel transaction with reason | Mistakes happen; no void = data integrity problems, cashier frustration | Low | PRD does not explicitly mention void/cancel — GAP |
| Discount at item level and cart level | Sellers routinely give item discounts and cart-wide promos | Low | PRD does not mention discounts — GAP |
| Hold transaction (suspend & resume) | Cashier needs to help another customer while first customer retrieves payment | Low | PRD does not mention hold — minor gap |
| Transaction search / history at POS | Cashier needs to look up recent transactions for customer queries | Low | PRD does not mention — minor gap |

### Inventory Module

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Real-time stock levels per SKU | Foundation of everything else | Low | PRD covers this |
| Stock movement log (append-only) | Required for zero-discrepancy goal | Medium | PRD covers this |
| Low-stock alerts | Owner/warehouse staff need proactive warnings | Low | PRD covers this |
| Product variants (size, color, etc.) | Indonesian fashion/clothing retail is a major category — variants are non-negotiable | Medium | PRD covers this |
| Barcode/SKU management | Required for POS scan | Low | PRD covers this implicitly |
| Stock opname (physical count reconciliation) | Periodic stock count and reconciliation is mandatory in any retail operation | High | PRD does NOT mention stock opname — SIGNIFICANT GAP |
| Stock reservation for unshipped orders | Prevents overselling when marketplace orders are pending | Medium | PRD covers this |
| Multi-unit of measure (pcs, lusin, karton) | Indonesian wholesale-to-retail business often buys by carton, sells by piece | Medium | PRD does not mention UoM conversion — GAP for some product types |

### Warehouse Module

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Location hierarchy (Warehouse → Zone → Rack → Bin) | Required to locate physical stock | Medium | PRD covers this |
| Goods receipt from PO | Cannot receive stock without this | Low | PRD covers this |
| Picking list for outgoing orders | Warehouse staff needs to know what to pick for marketplace orders | Medium | PRD covers this |
| Packing workflow | Confirmation step before shipment | Low | PRD covers this |
| Goods transfer between locations | Moving stock within warehouse or between storage areas | Low | PRD mentions TRANSFER movement type but warehouse transfer workflow is implicit |
| Inbound delivery scheduling | When suppliers arrive, who receives? | Low | PRD is implicit — PO receive flow covers this |

### Procurement Module

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Purchase Order creation | Core procurement action | Low | PRD covers this |
| PO approval workflow | Prevents unauthorized spending | Low | PRD covers Owner/Admin approval |
| Supplier master data | Cannot create POs without suppliers | Low | PRD has suppliers table in schema |
| Goods receipt with partial receive | Suppliers often deliver in partial shipments | Medium | PRD's PO receive flow does not explicitly mention partial receive — GAP |
| PO status tracking | Owner needs to know what's ordered, in transit, received | Low | PRD implies this via PO lifecycle |
| Supplier payment tracking | Accounts payable: which POs are paid vs outstanding | Medium | PRD has Accounts Payable in journal entries but explicit AP aging report is not mentioned — GAP |

### Marketplace Integration

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Order import from Shopee + TikTok Shop | Manual order copy-paste is the exact pain point being solved | High | PRD covers this |
| Inventory sync push to marketplaces | Overselling on marketplace = bad reviews, penalties | High | PRD covers this |
| Webhook handling for order events | Real-time is required; polling is too slow and rate-limited | High | PRD covers this |
| Order status management (confirm, ready to ship) | Seller must confirm orders within marketplace SLA (usually 48h) | Medium | PRD mentions order.shipped event but the outbound status update (seller confirming order) is a GAP |
| Airwaybill / AWB generation handoff | Marketplace orders need shipping label; usually done via marketplace API | Medium | PRD mentions shipment tracking but AWB creation flow is not explicit — GAP |
| Marketplace fee reconciliation | Each marketplace charges commission, payment fees; must reconcile against actual payouts | High | PRD does NOT mention marketplace fee reconciliation — SIGNIFICANT GAP for Finance accuracy |
| Shopee/TikTok Shop token management (OAuth) | API tokens expire; refresh must be automatic or shop disconnects | Medium | PRD does not explicitly call out token lifecycle management — GAP |

### Finance & Accounting

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Double-entry journal auto-generation | Foundation of accurate books | High | PRD covers this |
| Chart of accounts | Double-entry requires a configured COA | Medium | PRD schema has `accounts` table but COA seeding/management UI is not explicit |
| P&L report | Owner's primary financial view | Medium | PRD covers this |
| Balance Sheet | Required for any serious accounting | Medium | PRD covers this |
| Cash Flow statement | Liquidity visibility | Medium | PRD covers this |
| Account receivable tracking | Marketplace payouts are not instant — settlement lags 7–14 days | Medium | PRD has AR in journal entries but explicit AR aging report is not mentioned |
| PPN (VAT 11%) handling | Indonesian PPN is 11% (as of April 2022, raised from 10%). Any registered PKP business must charge and report PPN | High | PRD does NOT mention PPN/VAT at all — CRITICAL GAP for Indonesian compliance |

### Payroll

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Base salary calculation | Foundation | Low | PRD covers this |
| Allowances (tunjangan) | Transport, meal, positional allowances are standard Indonesian practice | Low | PRD covers this |
| BPJS Kesehatan deduction | Mandatory Indonesian health insurance; employee portion: 1%, employer: 4% of salary | Medium | PRD covers BPJS deductions — verify current rates apply |
| BPJS Ketenagakerjaan deduction | JHT (employee 2%, employer 3.7%), JP (employee 1%, employer 2%), JKK, JKM | Medium | PRD covers BPJS deductions — specific split is critical for compliance |
| PPh 21 calculation | Indonesian employee income tax; rates use progressive brackets | High | PRD covers PPh 21 — see Indonesian specifics section for detail |
| Slip gaji export (PDF) | Employees need paper/digital payslip | Low | PRD covers this |
| Monthly payroll run | Trigger payroll for all employees in one action | Low | PRD implies this |
| Loan/advance deduction | Employee loans deducted from salary is extremely common in Indonesian SME | Low | PRD mentions pinjaman deduction — correctly included |

### Analytics

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Revenue dashboard (today/week/month) | Owner's daily view | Low | PRD covers this |
| Sales by product/category | Understand what's selling | Low | PRD covers this |
| Sales by channel (POS vs Shopee vs TikTok) | Multi-channel business needs channel comparison | Low | PRD covers this |
| Stock value report | Finance needs to know inventory asset value | Low | PRD does not explicitly mention — minor gap |
| Margin/profitability by product | Owner needs to know which products actually make money | Medium | PRD mentions margin in KPI dashboard; needs COGS tracking |

---

## Differentiators

Features that set K21 apart from basic POS + spreadsheet approach. Not table stakes, but high value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| WhatsApp receipt delivery | Indonesian customers overwhelmingly prefer WhatsApp over email; receipt on WA feels personal | Medium | Requires Whatsapp Business API (Meta) or third-party (e.g., Wablas, Fonnte) — low cost; can be phase 2 |
| Supplier price history tracking | Owner can see if supplier raised prices across PO history | Low | Track landed cost per PO; minimal extra schema work |
| Product performance heatmap by time of day/day of week | Understand when which products sell; optimize staffing and promotions | Medium | Needs time-series query on transactions; Phase 9 enhancement |
| Automatic reorder point suggestion | Based on sales velocity + lead time, suggest when to reorder | Medium | Computed field on product; Phase 2 enhancement |
| Marketplace payout reconciliation dashboard | Visual reconciliation between expected and actual Shopee/TikTok payouts, surfacing fee discrepancies | High | Major pain point for multi-channel sellers; not in PRD currently |
| Bulk product upload via CSV | Adding 100+ products one by one is painful; CSV import is a huge DX win | Low | Standard feature but commonly omitted in v1 builds; worth including early |
| Role-specific dashboards | Owner sees finance KPIs; warehouse staff sees stock alerts; cashier sees only POS | Medium | RBAC already planned; role-scoped dashboard is the UX complement |
| POS keyboard shortcuts / fast mode | Experienced cashiers want speed; mouse-heavy UI is frustrating | Low | CSS/JS shortcut layer on POS UI |
| Barcode label printing | Print product labels for shelf/bin identification | Low | Small but very practical for warehouse operations |
| Return/refund workflow with inventory reversal | Customer returns need structured handling: inspect, accept/reject, restock, refund | High | Inventory RETURN type exists in PRD but the POS/business workflow around it is not defined |

---

## Anti-Features

Features to deliberately NOT build in v1. These would consume disproportionate time relative to value for a 10-person business.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Customer loyalty / points program | Complex to implement correctly; minimal value for a business still systematizing basics | Handle via marketplace native loyalty programs (Shopee Coins, etc.) |
| Multi-store / multi-branch | PRD explicitly out of scope; adds enormous schema and RBAC complexity | Architecture with domain boundaries means extraction is possible later |
| Native mobile app (iOS/Android) | PWA covers offline POS; native app doubles the maintenance burden | PWA with offline mode is sufficient; add to roadmap only if specific native capability is needed |
| E-commerce storefront (own website) | Business already uses Shopee + TikTok Shop; own storefront competes poorly for discovery | Direct marketplace integration is the right channel for this business size |
| CRM / customer history | No customer accounts at POS level; repeat customers managed via marketplace | Keep POS transactional; CRM is a future phase if WhatsApp customer data is collected |
| Predictive demand forecasting (ML) | Requires data volume and ML infra this business won't have in year 1 | Manual reorder points with velocity data is sufficient |
| Integration with Lazada / Tokopedia | PRD explicitly deferred; spreads integration work thin | Solid Shopee + TikTok integration first; add others only when business demands |
| Multi-currency | This business operates entirely in IDR | Hard-code IDR; add currency abstraction only if international suppliers emerge |
| Consignment / vendor-managed inventory | Not mentioned in business context; complex ownership model | Standard PO-based procurement is correct for this context |
| EDI / supplier portal | Supplier scale is too small to warrant EDI | Email/WhatsApp PO transmission is sufficient; PDF export from system |

---

## Critical Gaps in Current PRD

The following features are NOT in the PRD but are critical for correctness or Indonesian compliance:

### Gap 1: PPN / VAT (PPN 11%) — CRITICAL

**What:** Indonesian Value Added Tax (Pajak Pertambahan Nilai), currently 11% (raised from 10% in April 2022, 12% increase being discussed). Any retailer registered as PKP (Pengusaha Kena Pajak) must charge PPN on taxable sales and file monthly SPT Masa PPN.

**Why critical:** If this business is or becomes PKP, every POS transaction and marketplace sale must include PPN tracking. The finance module generating journal entries without PPN support produces incorrect books. Even if not currently PKP (threshold: Rp4.8 billion annual revenue), building the data model to track tax-inclusive vs tax-exclusive pricing now avoids a painful migration later.

**Required features:**
- Product-level tax classification (kena pajak vs tidak kena pajak)
- Transaction-level tax calculation and display
- PPN output tax account in COA
- Monthly PPN summary for reporting (as input to e-Faktur filing, which itself is out of scope)

**Confidence:** MEDIUM — PPN rate and PKP threshold from training data (August 2025 cutoff); verify current rate before implementing.

### Gap 2: Stock Opname (Physical Count) — SIGNIFICANT

**What:** Periodic physical stock counting and reconciliation against system records. In Indonesian retail practice, stock opname is done monthly or quarterly. The result is a batch of ADJUSTMENT movements to correct discrepancies found.

**Why critical:** Without a structured stock opname workflow, the "zero inventory discrepancy" goal cannot be verified. You need a workflow to:
1. Freeze or snapshot system stock quantities
2. Record physical count per location/SKU
3. Calculate variance
4. Generate ADJUSTMENT movements for variances (with approver and reason)
5. Produce stock opname report

**Required features:**
- Stock opname session (create, assign to staff, complete)
- Count entry interface by location
- Variance calculation vs system stock
- Adjustment batch approval by Owner/Admin
- Stock opname report

**Confidence:** HIGH — this is universal retail operations practice, not Indonesia-specific.

### Gap 3: Void / Cancel POS Transaction

**What:** Ability to void a POS transaction (same-shift or with Manager authorization) that was entered incorrectly.

**Why critical:** Without void, cashier errors produce permanent false inventory deductions and incorrect revenue records. Indonesian tax regulations also require that cancelled sales be properly reversed (credit note or void documentation).

**Required features:**
- Void within same shift (Cashier-initiated)
- Void cross-shift (requires Owner/Admin authorization)
- Void generates reversing inventory movement and reversing journal entry
- Void reason is mandatory and audited

**Confidence:** HIGH — universal POS requirement.

### Gap 4: Discount Engine

**What:** Support for discounts at item level (percentage or fixed amount), cart-level discount, and potentially promotional pricing (e.g., buy 2 get 10% off).

**Why critical:** Indonesian retail sellers routinely offer discounts. Without a discount field, cashiers use workarounds (adjust price manually, causing COGS/revenue distortion). Marketplace promotions also generate orders at discounted prices that must reconcile correctly.

**Required features:**
- Item-level discount (% or IDR)
- Cart-level discount (% or IDR)
- Discount reason/label for reporting
- Discounted price still generates correct COGS deduction (COGS does not discount, only revenue does)

**Confidence:** HIGH — universal retail requirement.

### Gap 5: PO Partial Receive

**What:** Suppliers frequently deliver Purchase Orders in multiple shipments. System must support receiving part of a PO and leaving the remainder open.

**Why critical:** Without partial receive, staff must either mark PO complete (losing visibility on outstanding goods) or not mark receipt at all (inventory not updated). Both are data integrity failures.

**Required features:**
- Receive partial quantity per PO line
- PO line status: Ordered → Partially Received → Fully Received
- PO status: Open → Partial → Closed
- Outstanding PO quantity visible to procurement

**Confidence:** HIGH — universal procurement requirement.

### Gap 6: Marketplace Token / OAuth Lifecycle Management

**What:** Shopee Open Platform and TikTok Shop use OAuth 2.0 access tokens with expiry (typically Shopee: 4 hours access token, 30 days refresh token; TikTok Shop: similar). Token refresh must be automated; if token expires, marketplace sync silently stops.

**Why critical:** Silent marketplace sync failure is the worst kind of failure — inventory falls out of sync, overselling occurs, the system appears to work but doesn't. Token management must be monitored and alerting must fire when refresh fails.

**Required features:**
- Store OAuth credential record (access_token, refresh_token, expiry)
- Background job to refresh tokens before expiry
- Alert to Owner/Admin if token refresh fails
- Re-authorization flow if refresh token expires (requires manual re-auth via marketplace OAuth)
- Token storage encrypted at rest

**Confidence:** MEDIUM — token behavior from training knowledge of Shopee/TikTok Shop APIs as of August 2025; verify current token TTL in official API docs during Phase 6 research.

### Gap 7: Marketplace Payout Reconciliation

**What:** Shopee and TikTok Shop hold funds and release payouts on a schedule (typically weekly). Each payout is the gross order value minus: platform commission (1–3%), payment processing fee, advertising fee, shipping subsidy adjustments, returns/refunds. The Finance module must reconcile expected revenue against actual bank deposit.

**Why critical:** Without reconciliation, the Finance module overstates revenue (it records full order value) while bank shows lower actual payout. The difference (marketplace fees) must be booked as expenses.

**Required features:**
- Marketplace payout record (expected, actual, difference)
- Fee breakdown import or manual entry per payout period
- Journal entry: Dr Bank, Dr Marketplace Fees Expense, Cr Accounts Receivable - Marketplace
- Payout reconciliation report

**Confidence:** MEDIUM — fee structures from training knowledge; actual rates vary by seller tier and product category.

### Gap 8: Return / Refund Workflow

**What:** Customer returns at physical store (POS) and marketplace returns (both platforms have buyer return policies). Must handle: inspect returned goods, accept/reject, restock if acceptable, issue refund or exchange, reverse revenue.

**Why critical:** Marketplace return rates in Indonesian fashion/lifestyle retail can be 5–15%. Without proper return handling, inventory and revenue records become inaccurate.

**Required features:**
- POS return: reference original transaction, select returned items, inspect condition
- Restock good condition items (RETURN inventory movement)
- Write-off damaged items (ADJUSTMENT with reason)
- Reverse journal entry (Dr Revenue, Cr Cash/Refund Payable)
- Marketplace return: auto-import return events from webhook, update order status, adjust inventory

**Confidence:** HIGH — marketplace return handling is universal; Indonesian return rates from category knowledge.

---

## Indonesian Market Specifics

### Tax: PPh 21

**What it is:** Indonesian withholding tax on employee income. Employer withholds tax from monthly salary and remits to tax authority.

**Calculation method (Effective Rate / TER, as of PMK 168/2023 effective January 2024):**
- New TER (Tarif Efektif Rata-rata) method replaces old monthly calculation
- Three rate tables: TER A (PTKP TK/0 = Rp54 million/year), TER B (PTKP K/0, K/1), TER C (PTKP K/2, K/3)
- Monthly rate applied to gross salary; year-end reconciliation using progressive brackets
- Progressive annual brackets: 5% (≤Rp60M), 15% (Rp60M–250M), 25% (Rp250M–500M), 30% (Rp500M–5B), 35% (>Rp5B)
- PTKP (non-taxable income): TK/0 = Rp54M, K/0 = Rp58.5M, K/1 = Rp63M, K/2 = Rp67.5M, K/3 = Rp72M

**Implementation requirements:**
- Employee tax status field (TK/0, K/0, K/1, K/2, K/3)
- TER table lookup per employee per month
- Annual reconciliation calculation (December payroll)
- PPh 21 withheld shown on payslip
- Monthly PPh 21 summary report (as input to SPT Masa PPh 21 filing — filing itself is out of scope)

**Confidence:** MEDIUM — TER method (PMK 168/2023) from training knowledge; verify current PTKP values and brackets before implementing as regulations can be updated annually.

### Tax: BPJS Kesehatan

**Current rates (from training knowledge, subject to change):**
- Employee contribution: 1% of salary (capped at ceiling salary)
- Employer contribution: 4% of salary (capped at ceiling salary)
- Salary ceiling for BPJS calculation: approximately Rp12 million/month (verify current ceiling)
- Employees earning below minimum wage: government subsidy applies (not employer's concern)

**Implementation requirements:**
- BPJS Kesehatan enrollment flag per employee
- Monthly deduction calculation with salary ceiling cap
- Employer contribution as separate payroll expense entry
- BPJS Kesehatan payment summary report

**Confidence:** MEDIUM — rates from training knowledge; ceiling may have changed.

### Tax: BPJS Ketenagakerjaan

**Programs and rates (from training knowledge):**
- JHT (Jaminan Hari Tua): Employee 2%, Employer 3.7%
- JP (Jaminan Pensiun): Employee 1%, Employer 2% (capped at JP salary ceiling, approximately Rp9.5 million/month — verify)
- JKK (Jaminan Kecelakaan Kerja): Employer only, 0.24%–1.74% based on risk category (retail: typically 0.24%)
- JKM (Jaminan Kematian): Employer only, 0.30%

**Implementation requirements:**
- Risk category field per company/employee group for JKK rate
- JP salary ceiling cap in calculation
- Separate payroll expense entries for employer-side contributions
- Monthly BPJS Ketenagakerjaan summary per program

**Confidence:** MEDIUM — rates from training knowledge; JP ceiling and JKK categories may have updated.

### Payment Methods: QRIS

**What:** QR Code Indonesian Standard — unified QR payment standard mandated by Bank Indonesia. All major e-wallets (GoPay, OVO, Dana, ShopeePay, LinkAja) and bank transfer apps scan the same QRIS code.

**Implementation options for POS:**
- Static QRIS sticker: No API integration required; customer scans, teller confirms verbally. Simple but no automatic confirmation.
- Dynamic QRIS via payment gateway (Midtrans, Xendit, Doku): System generates QR per transaction with exact amount; payment confirmation is automatic via webhook. Better UX, requires payment gateway account.

**Recommendation for K21 v1:** Static QRIS is acceptable for a small store with 1–2 cashiers. Dynamic QRIS via Midtrans/Xendit adds recurring cost (transaction fee ~0.7% for QRIS) and integration complexity. Build with static QRIS first; add dynamic QRIS in phase 2 if reconciliation becomes a pain point.

**Confidence:** HIGH — QRIS is a well-established Bank Indonesia standard; static vs dynamic trade-off is well understood.

### Marketplace: Shopee Open Platform

**Key API capabilities (from training knowledge as of August 2025):**
- Product API: create/update/get product, manage variants, upload images
- Inventory API: update stock (push), get current stock
- Order API: get order list, get order detail, confirm order, ready to ship
- Logistics API: create shipping document, get tracking
- Shop API: get shop info, shop performance
- Token: OAuth 2.0, access token ~4h, refresh token ~30 days, refresh flow via API

**Rate limits:** Shopee enforces per-endpoint rate limits (typically 10–100 req/min depending on endpoint tier). BullMQ job queue in PRD correctly addresses this.

**Webhook events relevant to K21:** order.status.update (covers created, cancelled, ready_to_ship, shipped, completed), item.stock.update

**Confidence:** MEDIUM — API structure from training; verify exact endpoint names and rate limits from Shopee Open Platform docs during Phase 6 research.

### Marketplace: TikTok Shop

**Key API capabilities (from training knowledge as of August 2025):**
- Product API: create/update product, manage SKUs, price management
- Inventory API: update stock per warehouse, get inventory
- Order API: get order list, get order detail, confirm order, ship order, create package
- Fulfillment API: create shipping document, logistics tracking
- Authorization: OAuth 2.0, similar token lifecycle to Shopee

**Important TikTok Shop distinction:** TikTok Shop has a more complex fulfillment flow involving "packages" (an order may split into multiple packages). The PRD's simple order model may need extension for TikTok's package-level tracking.

**Confidence:** MEDIUM — API structure from training; TikTok Shop API evolves rapidly. Phase 6 research should verify current API version and fulfillment model.

---

## Feature Dependencies

```
Auth/RBAC
  └── All other modules (no module works without authentication)

Product Catalog + Variants
  ├── Inventory (inventory tracks product SKUs)
  ├── POS (cannot sell unregistered products)
  ├── Procurement (PO line items reference products)
  └── Marketplace Integration (product must exist locally to sync)

Inventory Movement Log
  ├── POS (SALE movements)
  ├── Procurement Goods Receipt (PURCHASE movements)
  ├── Warehouse Transfer (TRANSFER movements)
  ├── Returns (RETURN movements)
  ├── Stock Opname (ADJUSTMENT movements)
  └── Marketplace Orders (SALE movements via reservation)

Chart of Accounts
  └── Double-Entry Accounting (no journal entries without COA)

Double-Entry Accounting
  ├── POS transactions (auto journal)
  ├── Procurement (auto journal)
  ├── Marketplace sales (auto journal)
  └── Payroll (auto journal)

Payroll
  ├── PPh 21 calculation (requires employee tax profile)
  ├── BPJS Kesehatan (requires enrollment flag)
  └── BPJS Ketenagakerjaan (requires risk category)

Marketplace OAuth Tokens
  └── Marketplace Integration (sync cannot run without valid tokens)

Stock Opname [GAP]
  └── Inventory Adjustment (stock opname generates ADJUSTMENT movements)

Discount Engine [GAP]
  ├── POS (cashier applies discounts)
  └── Finance (discounted revenue reporting)

PPN/VAT [GAP]
  ├── Product catalog (tax classification per product)
  ├── POS (tax display and calculation)
  └── Finance (VAT output tax account)
```

---

## MVP Recommendation

Given this is an internal system replacing a simple POS for a real business with active pain points, the MVP should be functional end-to-end for the core daily operations loop.

**Phase 3 MVP (POS live):** The system becomes minimally useful when:
1. Cashier can process POS transactions with offline mode
2. Inventory updates automatically from POS
3. Discount support (item-level minimum) — without this cashiers will hack around it
4. Void/cancel transaction — without this the system is frustrating to use in production
5. Shift close reconciliation report

**Phase 6 MVP (Marketplace live):** The system eliminates the manual marketplace pain when:
1. Shopee orders import and update inventory automatically
2. TikTok Shop orders import and update inventory automatically
3. Stock sync pushes from ERP to both marketplaces
4. Token lifecycle management is automatic with alerts

**Defer to later phases:**
- WhatsApp receipt delivery (nice-to-have, not blocking operations)
- PPN/VAT full implementation (only if business crosses PKP threshold — build data model now, enforcement later)
- Marketplace payout reconciliation (manual workaround possible initially)
- Stock opname workflow (critical long-term, but initial launch can use manual ADJUSTMENT)
- Bulk CSV product import (valuable but not blocking)
- Return/refund structured workflow (RETURN movement type covers inventory; full workflow can follow)

---

## Sources

- Project context: `H:/AI/k21/.planning/PROJECT.md` and `H:/AI/k21/K21_PRD.md`
- Indonesian PPh 21 (TER method): PMK 168/2023, effective January 2024 — MEDIUM confidence, training data cutoff August 2025
- BPJS rates: Government Regulation PP 44/2015 (Ketenagakerjaan), Perpres 82/2018 (Kesehatan) — MEDIUM confidence, verify current ceilings
- PPN rate 11%: PMK 62/2022 (effective April 1, 2022) — MEDIUM confidence
- QRIS standard: Bank Indonesia regulation — HIGH confidence
- Shopee Open Platform API: training knowledge as of August 2025 — MEDIUM confidence, verify during Phase 6
- TikTok Shop API: training knowledge as of August 2025 — MEDIUM confidence, verify during Phase 6
- Retail ERP feature landscape: training knowledge of Moka POS, Jurnal.id, Paper.id, Accurate Online (Indonesian SME ERP products) — MEDIUM confidence
