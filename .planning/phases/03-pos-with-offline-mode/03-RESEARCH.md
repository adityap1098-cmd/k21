# Phase 3: POS with Offline Mode - Research

**Researched:** 2026-03-18
**Domain:** PWA offline-first POS, IndexedDB sync, ESC/POS thermal printing, shift management, atomic inventory sale
**Confidence:** HIGH (core stack verified against official sources; minor areas noted where confidence is MEDIUM)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **POS Screen Layout**: Split-screen — left panel (product search/scan + quick-add grid), right panel (cart + totals + BAYAR button). Everything visible at once.
- **Item-level discounts**: Tap cart line → inline expand with qty edit + discount field (% or flat Rp). No modal.
- **Transaction-level discount**: Separate field in the cart totals area. Both item and transaction discounts stored independently.
- **Cash payment**: Cashier enters amount tendered; system shows change. Quick-select buttons for common denominations (Rp50k, Rp100k, Rp200k).
- **QRIS**: Manual confirmation only — cashier selects QRIS, customer scans static merchant QR, cashier taps "Payment Received". No gateway API. Works offline.
- **Bank Transfer**: Manual confirmation — cashier records bank name + optional reference. Works offline.
- **Split payment**: Supported — multiple payment legs (e.g., Rp150k cash + Rp50k transfer), each leg recorded separately.
- **PWA with `@serwist/next`** (Phase 0 lock — not `next-pwa`).
- **Product catalog cache**: Full active product + variant catalog synced to IndexedDB. Stale stock shown offline with staleness warning.
- **Cache refresh**: Full sync on shift open / page load; background refresh every 15 minutes while online.
- **Transaction queue**: Offline transactions written to IndexedDB with `client_uuid` idempotency key.
- **Auto-sync on reconnect**: Service worker detects network restored → queued transactions submitted automatically in background. Status indicator shown.
- **Stock conflict handling**: NOT auto-voided. Flagged in "Sync Issues" list. Cashier/Owner can Approve (force-complete, stock may go negative) or Void (with reason). Both actions written to `audit_logs`.
- **Thermal print**: ESC/POS via browser's **Web Serial API**. 58mm and 80mm support.
- **Digital receipt**: "Share Receipt" button opens pre-filled WhatsApp URL with receipt text. No backend.
- **Receipt content**: store name, transaction ID, date/time, cashier name, itemized list, item discount, transaction discount, subtotal, tax (PPN if applicable), total, payment breakdown, change due, shift ID.
- **Shift**: One shift per cashier per session. Cashier opens with cash float. Close generates reconciliation: opening float + sales per method + expected cash + actual cash + discrepancy.
- **Transaction Void**: Mandatory reason (free text). Audit-logged. Stock restored via `inventory_movement(RETURN)`. Journal entry reversal. Append-only pattern maintained.
- **`variant_id` as atomic unit**: POS always operates on `variant_id`, never `product_id` directly.
- **`@serwist/next`** is not yet installed in `apps/web/package.json` — Phase 3 installs it.
- **Phase 7 accounting stub**: Phase 3 must make a journal entry stub call. Actual double-entry logic implemented in Phase 7.

### Claude's Discretion
- Quick-add grid default products and how cashier customizes it
- ESC/POS library choice (e.g., `@point-of-sale/receipt-printer-encoder` + `@point-of-sale/webserial-receipt-printer`)
- IndexedDB schema and version management (Dexie.js v4 strongly recommended)
- Exact Service Worker caching strategy (cache-first for static assets, network-first for API)
- PPN tax display logic on receipt (inclusive/exclusive)
- Exact UI for "Sync Issues" list — modal, sidebar, or dedicated page

### Deferred Ideas (OUT OF SCOPE)
- QRIS/payment gateway integration (Midtrans, Xendit)
- Customer management / loyalty points
- Online queue / booking system
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| POS-01 | Kasir dapat scan barcode produk atau cari manual untuk tambah ke cart | Product catalog cached in Dexie; barcode search via indexed field; name search via Dexie `startsWith` or `includes` |
| POS-02 | Kasir dapat tambah, kurangi, hapus item di cart, dan terapkan diskon per item | Zustand cart store (client-side only); discount = percent or flat Rp; both stored as `item_discount_type` + `item_discount_value` in transaction_items schema |
| POS-03 | Transaksi mendukung multi-payment: tunai, transfer bank, dan QRIS | `transaction_payments` table with `(transaction_id, method, amount)` rows; split payment = multiple rows summing to total |
| POS-04 | Setiap transaksi selesai menghasilkan receipt (cetak dan/atau digital) | `@point-of-sale/receipt-printer-encoder` + `@point-of-sale/webserial-receipt-printer` for thermal; WhatsApp URL share for digital |
| POS-05 | Kasir dapat membuka dan menutup shift dengan rekap total transaksi dan selisih kas | `shifts` table + `openShift`/`closeShift` service; reconciliation computed from aggregating `transaction_payments` within shift |
| POS-06 | Kasir dapat void/cancel transaksi yang sudah selesai (dengan alasan, tercatat di audit log) | Void writes `RETURN` inventory_movement + journal reversal in one `db.transaction()` + `logAudit()` call |
| POS-07 | POS berjalan sebagai PWA dengan Service Worker — aset ter-cache untuk offline access | `@serwist/next` v9.5.x; `withSerwist()` wraps next.config; `app/sw.ts` service worker; cache-first for static, network-first for API |
| POS-08 | Transaksi yang dibuat saat offline tersimpan di IndexedDB browser | Dexie v4; `offlineQueue` table stores serialized cart + payment + client_uuid |
| POS-09 | Saat koneksi pulih, transaksi offline auto-sync ke server dengan idempotency key (`client_uuid`) — tidak ada duplikasi | `navigator.onLine` + `online` event listener in sync manager; server uses `ON CONFLICT (client_uuid) DO NOTHING` |
| POS-10 | Server memvalidasi stok saat sync transaksi offline; konflik diflag untuk resolusi kasir | Sync endpoint checks stock availability for each variant; returns `conflictFlag: true` when stock unavailable; stored in `syncConflicts` Dexie table |
| POS-11 | Setiap transaksi POS selesai otomatis menghasilkan `inventory_movement(SALE)` dan `journal_entry` dalam satu atomic DB transaction | `db.transaction()` wraps: `decrementStock()` (existing) + `INSERT journal_entry_stub` — same pattern as Phase 2 opname service |
</phase_requirements>

---

## Summary

Phase 3 delivers a complete POS terminal for Indonesian retail — online and offline — built on the existing Express + Drizzle + Next.js monorepo. The backend side (API endpoints) follows well-established patterns already proven in Phases 1 and 2: `db.transaction()` for atomicity, `SELECT FOR UPDATE` for concurrency, `logAudit()` for audit trail, and `recordMovement()` for stock changes. The new complexity is entirely on the frontend: installing `@serwist/next` v9.5.x to enable a service worker, using Dexie v4 as the IndexedDB layer for offline transaction queue and product catalog cache, and Zustand for in-memory cart state. The thermal print path uses `@point-of-sale/receipt-printer-encoder` + `@point-of-sale/webserial-receipt-printer` which wrap the browser Web Serial API — this requires a Chromium-based browser (Chrome/Edge) and a user gesture to open the serial port on first use.

The most technically risky item — noted as HIGH RISK in `STATE.md` — is the PWA + Serwist + Next.js App Router integration. Version 9.5.x is confirmed stable and the official getting-started guide is current. The pattern requires `app/sw.ts` as the service worker source, `withSerwist()` wrapping `next.config`, and specific `tsconfig.json` additions for `webworker` lib types. This is not hand-rolled; the Serwist library handles precaching and offline fallback. The Phase 3 plan can proceed with confidence.

The offline sync strategy uses a simple client-driven approach: transactions written offline get a `client_uuid` (UUID v4 generated client-side via `crypto.randomUUID()`); when connectivity returns, the main thread's `online` event fires and a sync manager drains the Dexie `offlineQueue` table by submitting each transaction to `POST /api/v1/pos/sync`. The server upserts with `ON CONFLICT (client_uuid) DO NOTHING`, guaranteeing idempotency. No Background Sync API (which has poor cross-browser support) is needed as the primary mechanism.

**Primary recommendation:** Use Dexie v4 (not raw IDB API) for IndexedDB, `@serwist/next` v9 (not next-pwa) for the service worker, `@point-of-sale/receipt-printer-encoder` + `@point-of-sale/webserial-receipt-printer` for thermal printing, and Zustand v4 for in-memory cart state. The backend uses the identical `db.transaction()` + `decrementStock()` + `logAudit()` pattern already validated in Phase 2.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@serwist/next` | 9.5.6 | PWA service worker integration for Next.js | Only maintained PWA path for Next.js App Router; locked from Phase 0 |
| `serwist` | 9.5.7 (devDep) | Service worker build tooling | Peer dependency of `@serwist/next` |
| `dexie` | 4.3.0 | IndexedDB wrapper — offline queue + product cache | v4 is current stable; TypeScript-first; class-based schema; far simpler than raw IDB API |
| `zustand` | 4.x | Client-side cart state + shift state management | Works in Next.js App Router without Context boilerplate; `use client` stores |
| `@point-of-sale/receipt-printer-encoder` | latest | ESC/POS byte stream encoding | Replaces deprecated `esc-pos-encoder`; supports ESC/POS + StarPRNT; 58mm/80mm paper widths |
| `@point-of-sale/webserial-receipt-printer` | latest | Sends ESC/POS bytes to printer via Web Serial API | Abstracts browser Web Serial API; handles connect/reconnect lifecycle |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^3.x (already installed) | Request body validation on POS API endpoints | All POST endpoints: `/transactions`, `/sync`, `/shifts/open`, `/shifts/close`, `/:id/void` |
| `crypto.randomUUID()` | built-in (Node + Browser) | `client_uuid` generation | Both server and browser; available natively; no package needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@serwist/next` | `next-pwa` | `next-pwa` is unmaintained; `@serwist/next` is the supported successor for App Router |
| `dexie` | Raw IndexedDB API | Raw IDB has no TypeScript generics, awkward version migration, no chainable queries |
| `@point-of-sale/webserial-receipt-printer` | `react-thermal-printer` | react-thermal-printer adds JSX abstraction which is unnecessary; the point-of-sale libraries are lower-level and more controllable |
| Zustand | React Context | Context causes full subtree re-renders on every cart change; POS cart updates frequently |

### Installation

```bash
# In apps/web
pnpm --filter @k21/web add @serwist/next dexie zustand @point-of-sale/receipt-printer-encoder @point-of-sale/webserial-receipt-printer
pnpm --filter @k21/web add -D serwist

# No new backend packages needed — Express, Drizzle, Zod, Vitest already installed
```

---

## Architecture Patterns

### Recommended Project Structure

**Backend (apps/api/src/modules/)**
```
pos/
├── pos.service.ts          # completeSale(), syncOfflineTx(), getSalesByShift()
├── pos.router.ts           # POST /transactions, POST /sync, GET /transactions/:id
├── pos.test.ts             # unit tests with DB mocks
└── index.ts                # barrel export

shifts/
├── shifts.service.ts       # openShift(), closeShift(), getReconciliation()
├── shifts.router.ts        # POST /shifts/open, POST /shifts/close, GET /shifts/:id
├── shifts.test.ts
└── index.ts

void/
├── void.service.ts         # voidTransaction()
├── void.router.ts          # POST /pos/transactions/:id/void
├── void.test.ts
└── index.ts

accounting/
├── journal.service.ts      # createJournalEntryStub() — Phase 7 integration point
└── index.ts
```

**Frontend (apps/web/)**
```
app/
├── sw.ts                          # Serwist service worker entry point
├── (pos)/
│   └── pos/
│       └── page.tsx               # POS page — 'use client', mounts split-screen layout
└── components/
    └── pos/
        ├── ProductPanel.tsx       # Left: search bar + barcode + quick-add grid
        ├── CartPanel.tsx          # Right: cart lines + inline editor + totals + BAYAR
        ├── PaymentModal.tsx       # Cash change calc + QRIS confirm + transfer + split
        ├── ReceiptModal.tsx       # Print button (Web Serial) + WhatsApp share
        ├── ShiftDrawer.tsx        # Open/close shift + reconciliation view
        ├── SyncStatusBar.tsx      # "Syncing N transactions..." indicator
        └── SyncIssuesPanel.tsx    # Conflict resolution UI

lib/
├── db/
│   └── offline.db.ts              # Dexie class — offlineQueue, productCache, syncConflicts
├── stores/
│   ├── cart.store.ts              # Zustand — items[], discount, payment legs
│   └── shift.store.ts             # Zustand — active shift, online status
├── pos/
│   └── cart.utils.ts              # Pure functions: calculateLineTotal, calculateChangeDue
├── receipt/
│   └── whatsapp.ts                # buildWhatsAppReceiptUrl()
└── sync/
    └── sync.manager.ts            # online event listener → drain offlineQueue → POST /pos/sync
```

### Pattern 1: Atomic POS Sale (POS-11)

**What:** A single `db.transaction()` that: (1) decrements stock via `recordMovement(SALE)` using `SELECT FOR UPDATE`, (2) inserts `transactions` + `transaction_items` + `transaction_payments` rows, (3) inserts journal entry stub. All-or-nothing.

**When to use:** Every completed sale — online or synced offline.

```typescript
// Source: mirrors Phase 2 decrementStock pattern in movement.service.ts
// Note: decrementStock() itself wraps db.transaction() internally.
// For multi-item atomicity, pass the outer tx to recordMovement directly
// (same approach used in opname.service.ts for multi-variant adjustments)

export async function completeSale(params: CompleteSaleParams): Promise<Transaction> {
  return await db.transaction(async (tx) => {
    // 1. Lock and decrement stock for each variant
    for (const item of params.items) {
      const rows = await tx.execute(
        sql`SELECT id, stock_qty FROM product_variants WHERE id = ${item.variantId} FOR UPDATE`
      )
      const variant = rows[0] as { id: string; stock_qty: number }
      if (!variant) throw new Error('VARIANT_NOT_FOUND')
      if (variant.stock_qty < item.qty) throw new Error('INSUFFICIENT_STOCK')

      await recordMovement({
        variantId: item.variantId,
        movementType: 'SALE',
        qty: item.qty,
        reference: params.clientUuid,
        performedBy: params.cashierId,
      }, tx)

      await tx.execute(
        sql`UPDATE product_variants SET stock_qty = stock_qty - ${item.qty}, updated_at = now() WHERE id = ${item.variantId}`
      )
    }

    // 2. Insert transaction record
    const [txRow] = await tx.insert(transactions).values({
      id: randomUUID(),
      clientUuid: params.clientUuid,
      shiftId: params.shiftId,
      cashierId: params.cashierId,
      totalAmount: params.totalAmount,
      discountAmount: params.discountAmount ?? 0,
      status: 'COMPLETED',
    }).returning()

    // 3. Insert items
    await tx.insert(transactionItems).values(
      params.items.map(item => ({ ...item, transactionId: txRow.id }))
    )

    // 4. Insert payment legs
    await tx.insert(transactionPayments).values(
      params.payments.map(p => ({ ...p, transactionId: txRow.id }))
    )

    // 5. Journal entry stub (Phase 7 integration hook)
    await createJournalEntryStub(tx, {
      source: 'POS_SALE',
      referenceId: txRow.id,
      amount: params.totalAmount,
    })

    return txRow
  })
}
```

### Pattern 2: Idempotent Offline Sync (POS-09)

**What:** `POST /api/v1/pos/sync` accepts a transaction payload with `client_uuid`. The server uses Postgres `ON CONFLICT (client_uuid) DO NOTHING RETURNING *` — if the transaction was already synced (duplicate retry), the insert is a no-op and the endpoint returns the existing record.

**When to use:** When the online event fires, the sync manager submits each queued transaction via this endpoint.

```typescript
// In pos.service.ts — syncOfflineTx()
// The transactions table has UNIQUE constraint on client_uuid (see schema)
// ON CONFLICT (client_uuid) DO NOTHING RETURNING *
// If RETURNING is empty => already synced, fetch by client_uuid and return with alreadySynced: true

export async function syncOfflineTx(params: SyncTxParams): Promise<SyncResult> {
  // Use raw sql for upsert — Drizzle .onConflictDoNothing() available in v0.30
  const existing = await db
    .select()
    .from(transactions)
    .where(eq(transactions.clientUuid, params.clientUuid))
    .limit(1)

  if (existing.length > 0) {
    return { transaction: existing[0], alreadySynced: true }
  }

  // Not yet synced — attempt stock validation before insert
  for (const item of params.items) {
    const reserved = await getActiveReservedQty(db, item.variantId)
    const variant = await getVariantStock(item.variantId)
    if (!variant || (variant.stockQty - reserved) < item.qty) {
      // Return conflict flag — do NOT complete the transaction
      return {
        transaction: null,
        alreadySynced: false,
        conflictFlag: true,
        conflictDetail: `INSUFFICIENT_STOCK for variant ${item.variantId}`,
      }
    }
  }

  const txRow = await completeSale(params)
  return { transaction: txRow, alreadySynced: false, conflictFlag: false }
}
```

### Pattern 3: Dexie Offline Database

**What:** One singleton Dexie instance exported from `lib/db/offline.db.ts`. Three tables: `offlineQueue` (pending transactions), `productCache` (product catalog for offline use), `syncConflicts` (flagged transactions needing resolution).

```typescript
// Source: Dexie v4 docs — https://dexie.org/docs/Download
// apps/web/lib/db/offline.db.ts
import Dexie, { type Table } from 'dexie'

export interface OfflineQueueItem {
  id?: number             // auto-increment primary key
  clientUuid: string      // idempotency key
  payload: object         // serialized CompleteSaleParams
  createdAt: number       // Date.now()
  status: 'pending' | 'syncing' | 'failed'
}

export interface ProductCacheItem {
  variantId: string       // primary key
  sku: string
  barcode: string | null
  name: string
  price: number
  stockQty: number        // last-known — decrement locally after each offline sale
  cachedAt: number
}

export interface SyncConflict {
  id?: number
  transactionId: string   // client_uuid of the conflicted transaction
  payload: object         // original sale payload — needed for approve/void
  conflictDetail: string
  status: 'pending' | 'approved' | 'voided'
  detectedAt: number
}

export class OfflineDb extends Dexie {
  offlineQueue!: Table<OfflineQueueItem>
  productCache!: Table<ProductCacheItem>
  syncConflicts!: Table<SyncConflict>

  constructor() {
    super('k21-pos')
    this.version(1).stores({
      offlineQueue: '++id, clientUuid, status',
      productCache: 'variantId, barcode, &sku',
      syncConflicts: '++id, transactionId, status',
    })
  }
}

// Export ONE singleton — never instantiate OfflineDb more than once
export const offlineDb = new OfflineDb()
```

### Pattern 4: Serwist Next.js Setup

```typescript
// Source: https://serwist.pages.dev/docs/next/getting-started
// next.config.mjs
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
})

export default withSerwist({
  // existing Next.js config
})
```

```typescript
// app/sw.ts
import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}
declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
})

serwist.addEventListeners()
```

`tsconfig.json` additions required:
- Add `"@serwist/next/typings"` to `compilerOptions.types`
- Add `"webworker"` to `compilerOptions.lib`
- Add `public/sw.js` to `exclude`

`.gitignore` additions:
```
public/sw*
public/swe-worker*
```

### Pattern 5: Thermal Receipt Printing

```typescript
// Source: https://github.com/NielsLeenheer/WebSerialReceiptPrinter
// apps/web/lib/print/thermal.ts
import { ReceiptPrinterEncoder } from '@point-of-sale/receipt-printer-encoder'
import { WebSerialReceiptPrinter } from '@point-of-sale/webserial-receipt-printer'

let printer: InstanceType<typeof WebSerialReceiptPrinter> | null = null

// Must be called from a button click handler (user gesture required by Web Serial API)
export async function connectPrinter(): Promise<void> {
  printer = new WebSerialReceiptPrinter()
  await printer.connect()
}

export function encodeReceipt(receipt: ReceiptData, paperWidth: 58 | 80): Uint8Array {
  // 58mm thermal printers typically support 32 columns; 80mm support 48
  const encoder = new ReceiptPrinterEncoder({ language: 'esc-pos' })
  return encoder
    .initialize()
    .align('center')
    .bold(true)
    .text(receipt.storeName)
    .bold(false)
    .newline()
    .align('left')
    .text(`ID: ${receipt.transactionId.slice(0, 8)}`)
    .newline()
    // ... itemized lines, totals, payment breakdown
    .cut()
    .encode()
}

export async function printReceipt(receipt: ReceiptData, paperWidth: 58 | 80): Promise<void> {
  if (!printer) throw new Error('PRINTER_NOT_CONNECTED')
  const data = encodeReceipt(receipt, paperWidth)
  await printer.print(data)
}
```

### Pattern 6: Cart Pure Functions

```typescript
// apps/web/lib/pos/cart.utils.ts — pure functions, testable without DOM
export function calculateChangeDue(totalAmount: number, cashTendered: number): number {
  return Math.max(0, cashTendered - totalAmount)
}

export function calculateLineTotal(
  qty: number,
  unitPrice: number,
  discountType: 'PERCENTAGE' | 'FLAT' | null,
  discountValue: number
): number {
  const gross = qty * unitPrice
  if (!discountType || discountValue === 0) return gross
  if (discountType === 'PERCENTAGE') return Math.round(gross * (1 - discountValue / 100))
  return Math.max(0, gross - discountValue)
}

export function calculateTransactionTotal(
  items: Array<{ lineTotal: number }>,
  txDiscountType: 'PERCENTAGE' | 'FLAT' | null,
  txDiscountValue: number
): number {
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)
  if (!txDiscountType || txDiscountValue === 0) return subtotal
  if (txDiscountType === 'PERCENTAGE') return Math.round(subtotal * (1 - txDiscountValue / 100))
  return Math.max(0, subtotal - txDiscountValue)
}
```

### Anti-Patterns to Avoid

- **Do NOT use `next-pwa`**: It is unmaintained and incompatible with Next.js App Router. The project has locked `@serwist/next`.
- **Do NOT use raw IndexedDB API**: Dexie's type-safe `Table<T>` wrapper and version migration are mandatory for maintainability.
- **Do NOT split the POS sale across multiple API calls**: Stock decrement + transaction insert + journal stub must be in one `db.transaction()`. Never POST "create transaction" and then POST "decrement stock" separately.
- **Do NOT auto-void on stock conflict**: Per locked decisions, conflicts go to a manual resolution list. Auto-voiding is a hard no-go.
- **Do NOT call stock mutations from the frontend directly**: All stock decrements are server-side only. Offline transactions are queued and synced; the decrement happens on the server at sync time.
- **Do NOT store the entire product catalog in Zustand**: Zustand is in-memory only. Use Dexie for the product cache that survives page reload and works offline.
- **Do NOT use Background Sync API as the only sync trigger**: Background Sync is Chromium-only and disabled in Firefox/Safari. Use `online` event listener as the primary trigger.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB schema migrations | Custom IDB versioned schema | `dexie` v4 `.version(N).stores({...})` | IDB migration bugs are silent and data-corrupting; Dexie handles upgrade transactions correctly |
| Service Worker precaching | Custom cache manifest generation | `@serwist/next` + `withSerwist()` | Cache-busting via content hash is non-trivial; Serwist generates `__SW_MANIFEST` automatically during build |
| ESC/POS byte stream encoding | Custom byte string builder | `@point-of-sale/receipt-printer-encoder` | ESC/POS has hundreds of printer codes; character encoding (CP437, UTF-8 fallback) is the hidden complexity |
| Web Serial printer lifecycle | Custom serial port open/close | `@point-of-sale/webserial-receipt-printer` | Permission persistence, reconnect on page reload, and error recovery are non-trivial |
| Idempotency checking | Custom "have I seen this UUID" query | `UNIQUE CONSTRAINT (client_uuid)` + `ON CONFLICT DO NOTHING` | Database-level uniqueness is the only reliable guarantee under concurrent requests |
| Cart state serialization to persistence | localStorage JSON | Zustand store (in-memory) + Dexie (offline queue) | localStorage sync is blocking; Dexie is async and survives storage quota issues more gracefully |

**Key insight:** The three hardest problems in this phase — service worker lifecycle, IndexedDB versioning, and ESC/POS byte encoding — all have well-maintained libraries that the point-of-sale community has used for years. None of them should be hand-rolled.

---

## Common Pitfalls

### Pitfall 1: PgBouncer TRANSACTION mode breaks SELECT FOR UPDATE outside db.transaction()
**What goes wrong:** `SELECT ... FOR UPDATE` sent outside of `db.transaction()` releases the connection back to PgBouncer before the next statement. The lock is immediately dropped; the subsequent UPDATE runs on a different connection and is not protected.
**Why it happens:** PgBouncer in TRANSACTION pool mode assigns a connection per transaction boundary, not per session.
**How to avoid:** Phase 2 already solved this — all `SELECT FOR UPDATE` calls use `tx.execute(...)` inside `db.transaction(async (tx) => {...})`. POS sale follows the exact same pattern. Never call `db.execute(sql\`FOR UPDATE\`)` at the top-level `db` object.
**Warning signs:** Tests pass but race condition manifests under load; stock goes negative despite the check.

### Pitfall 2: Missing UNIQUE constraint on `transactions.client_uuid`
**What goes wrong:** Server processes the same offline transaction twice — once when cashier manually triggers sync and once when auto-sync fires — resulting in duplicate inventory decrements and double journal entries.
**Why it happens:** Without a DB-level UNIQUE constraint on `transactions.client_uuid`, both inserts succeed.
**How to avoid:** `transactions` table schema MUST include `.unique()` on `clientUuid` column. The sync endpoint checks for existing record first (or uses `ON CONFLICT (client_uuid) DO NOTHING RETURNING *`). If RETURNING is empty, return the existing record.
**Warning signs:** Inventory goes negative after connectivity is restored; duplicate receipts issued.

### Pitfall 3: Multiple Dexie instances opening the same DB
**What goes wrong:** Two code paths create `new OfflineDb()` with potentially different version numbers; IndexedDB version upgrade transaction fails with `VersionError`.
**Why it happens:** Dexie opens the DB on first access. Constructing two instances of the same DB name in the same browser tab causes a conflict.
**How to avoid:** Export one singleton `offlineDb` from `lib/db/offline.db.ts`. Import it everywhere. Never construct a second `new OfflineDb()`.
**Warning signs:** `VersionError: The requested version (1) is less than the existing version (2)` in browser console.

### Pitfall 4: Web Serial API requires user gesture on first connect
**What goes wrong:** Calling `printer.connect()` programmatically on page load throws `SecurityError: Must be handling a user gesture to show a permission request`.
**Why it happens:** Browser security policy restricts Web Serial port requests to user-initiated events.
**How to avoid:** The connect call MUST be triggered by a button click event — e.g., a "Connect Printer" button in POS settings. Store the connected printer reference in a module-level variable. Use `printer.reconnect(lastDevice)` for subsequent page loads (reconnect does not require user gesture for a previously-permitted device).
**Warning signs:** `SecurityError` in browser console on print attempt.

### Pitfall 5: Serwist-generated `public/sw.js` checked into git
**What goes wrong:** Every build regenerates `public/sw.js`; git shows it as modified on every build, causing noisy diffs and potential CI failures.
**Why it happens:** `withSerwist()` outputs to `public/sw.js` by default.
**How to avoid:** Add `public/sw*` and `public/swe-worker*` to `.gitignore`. This is documented in the official Serwist getting-started guide.
**Warning signs:** `git status` always shows `public/sw.js` as modified after `next build`.

### Pitfall 6: Zustand hydration mismatch with Next.js App Router SSR
**What goes wrong:** Server renders with empty cart state; if Zustand persist writes to localStorage, client renders with previously persisted state; React hydration mismatch error.
**Why it happens:** Next.js SSR + Zustand persist can produce mismatched HTML.
**How to avoid:** The POS page must be fully client-side (`'use client'` at root). Avoid SSR for cart and shift stores. If using Zustand persist, set `skipHydration: true` and call `.persist.rehydrate()` manually in a `useEffect`.
**Warning signs:** React console: `Hydration failed because the server-rendered HTML doesn't match`.

### Pitfall 7: Offline product cache stockQty not updated after offline sales
**What goes wrong:** Cache shows `stockQty: 5`, cashier sells 5 units offline, sells 3 more — server sync fails POS-10 conflict for all 3 sold-while-stale items.
**Why it happens:** Cache is not decremented after each offline sale, so the client continues showing the original stale stock.
**How to avoid:** After each offline transaction is added to `offlineQueue`, immediately update the affected variants' `stockQty` in `productCache` by subtracting the sold quantity. Display a "[OFFLINE — estimated stock]" warning badge.
**Warning signs:** Consistently higher-than-expected POS-10 conflicts; cashier confusion about stock levels.

---

## Drizzle Schema: New Tables for Phase 3

```typescript
// apps/api/src/db/schema/pos.ts
// Source: Drizzle ORM patterns from Phase 2 schema files

// shifts
export const shiftStatusEnum = pgEnum('shift_status', ['OPEN', 'CLOSED'])
export const shifts = pgTable('shifts', {
  id:           uuid('id').primaryKey().defaultRandom(),
  cashierId:    uuid('cashier_id').notNull(),
  openingFloat: integer('opening_float').notNull(),
  closingCash:  integer('closing_cash'),
  status:       shiftStatusEnum('status').notNull().default('OPEN'),
  openedAt:     timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt:     timestamp('closed_at', { withTimezone: true }),
})

// transactions
export const transactionStatusEnum = pgEnum('transaction_status', ['COMPLETED', 'VOIDED'])
export const transactions = pgTable('transactions', {
  id:             uuid('id').primaryKey().defaultRandom(),
  clientUuid:     varchar('client_uuid', { length: 36 }).notNull().unique(), // idempotency key
  shiftId:        uuid('shift_id').notNull().references(() => shifts.id),
  cashierId:      uuid('cashier_id').notNull(),
  totalAmount:    integer('total_amount').notNull(),
  discountAmount: integer('discount_amount').notNull().default(0),
  status:         transactionStatusEnum('status').notNull().default('COMPLETED'),
  voidReason:     varchar('void_reason', { length: 500 }),
  voidedAt:       timestamp('voided_at', { withTimezone: true }),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// transaction_items
export const discountTypeEnum = pgEnum('discount_type', ['PERCENTAGE', 'FLAT'])
export const transactionItems = pgTable('transaction_items', {
  id:            uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').notNull().references(() => transactions.id),
  variantId:     uuid('variant_id').notNull(),
  qty:           integer('qty').notNull(),
  unitPrice:     integer('unit_price').notNull(),
  discountType:  discountTypeEnum('discount_type'),
  discountValue: integer('discount_value').notNull().default(0),
  lineTotal:     integer('line_total').notNull(),
})

// transaction_payments — one row per payment leg (supports split payment)
export const paymentMethodEnum = pgEnum('payment_method', ['CASH', 'TRANSFER', 'QRIS'])
export const transactionPayments = pgTable('transaction_payments', {
  id:            uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').notNull().references(() => transactions.id),
  method:        paymentMethodEnum('method').notNull(),
  amount:        integer('amount').notNull(),
  bankName:      varchar('bank_name', { length: 100 }),
  reference:     varchar('reference', { length: 100 }),
})

// journal_entries stub — Phase 7 will expand to full double-entry
export const journalEntries = pgTable('journal_entries', {
  id:          uuid('id').primaryKey().defaultRandom(),
  source:      varchar('source', { length: 50 }).notNull(),    // 'POS_SALE', 'POS_VOID'
  referenceId: uuid('reference_id').notNull(),
  amount:      integer('amount').notNull(),
  isVoided:    boolean('is_voided').notNull().default(false),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-pwa` | `@serwist/next` v9 | 2023 | `next-pwa` unmaintained; `@serwist/next` is the only supported path for App Router |
| `esc-pos-encoder` | `@point-of-sale/receipt-printer-encoder` | 2024 | `esc-pos-encoder` deprecated; replacement is backwards-compatible |
| `idb` raw wrapper | `dexie` v4 | Dexie v4 stable 2024 | v4 adds TypeScript generics at the table level; simpler schema definition |
| Background Sync API as primary trigger | `online` event listener | 2025 (confirmed) | Background Sync remains Chromium-only; `online` event is universally supported and sufficient |

**Deprecated/outdated:**
- `next-pwa`: unmaintained, incompatible with App Router — do not use
- `esc-pos-encoder`: deprecated in favor of `@point-of-sale/receipt-printer-encoder`
- Background Sync API as sole sync mechanism: Firefox disabled, Safari not implemented — use as enhancement only, not primary

---

## Open Questions

1. **Quick-add grid persistence scope**
   - What we know: Claude's discretion — no locked decision on storage location
   - What's unclear: Server DB table vs browser-only Dexie storage
   - Recommendation: Store grid product variant IDs in a `userPrefs` Dexie table keyed by `cashierId`. Populated from `productCache` on shift open. No server round-trip needed; cashier-local customization is appropriate.

2. **PPN tax display on receipt**
   - What we know: Products have `ppnType` field from Phase 2. PPN rate was 11% in 2024, confirmed HIGH RISK in STATE.md (pending 12% regulatory change).
   - What's unclear: Tax-inclusive vs tax-exclusive price display
   - Recommendation: Display inclusive price only (standard for Indonesian retail receipts). Add `taxAmount` field to `journalEntries` stub for Phase 7 to expand upon. Do not hard-code 11% or 12% — derive from product `ppnType` flag and a configurable rate constant.

3. **Sync conflict UI placement (Claude's discretion)**
   - Recommendation: Implement as a non-blocking panel/drawer (not a modal) accessible from the SyncStatusBar. Conflicted transactions should not block the cashier from continuing new sales. The panel shows pending conflicts with Approve/Void actions.

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 1.6.0 (already installed in `apps/api`) |
| Config file | `apps/api/vitest.config.ts` — exists, covers `src/**/*.test.ts` |
| Quick run command | `pnpm --filter @k21/api test` |
| Full suite command | `pnpm --filter @k21/api test:coverage` |
| Frontend test runner | None configured yet in `apps/web` — Wave 0 gap |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POS-01 | Barcode lookup finds correct variant in product cache | Unit | `pnpm --filter @k21/api test` — `pos.test.ts` | Wave 0 gap |
| POS-01 | Name search returns variants whose name contains search string | Unit | `pnpm --filter @k21/api test` — `pos.test.ts` | Wave 0 gap |
| POS-02 | `calculateLineTotal` with PERCENTAGE discount produces correct lineTotal | Unit (pure fn) | `pnpm --filter @k21/api test` — `pos.test.ts` or web unit test | Wave 0 gap |
| POS-02 | `calculateLineTotal` with FLAT discount clamps to zero minimum | Unit (pure fn) | same | Wave 0 gap |
| POS-02 | `calculateTransactionTotal` with transaction-level discount is correct | Unit (pure fn) | same | Wave 0 gap |
| POS-03 | Split payment: two payment legs (CASH + TRANSFER) both recorded | Integration | `pnpm --filter @k21/api test` — `pos.test.ts` | Wave 0 gap |
| POS-03 | Total of all payment legs must equal transaction total | Unit | `pnpm --filter @k21/api test` — `pos.test.ts` | Wave 0 gap |
| POS-04 | `buildWhatsAppReceiptUrl` encodes all required receipt fields | Unit | Frontend unit test | Wave 0 gap |
| POS-04 | Thermal print via Web Serial | Manual — requires physical printer | N/A | N/A |
| POS-05 | `openShift` records cashierId + openingFloat + OPEN status | Integration | `pnpm --filter @k21/api test` — `shifts.test.ts` | Wave 0 gap |
| POS-05 | `closeShift` reconciliation: expectedCash = openingFloat + sum(CASH payments) | Unit | `pnpm --filter @k21/api test` — `shifts.test.ts` | Wave 0 gap |
| POS-05 | Cannot open second shift while one is OPEN — throws SHIFT_ALREADY_OPEN | Integration | `pnpm --filter @k21/api test` — `shifts.test.ts` | Wave 0 gap |
| POS-06 | `voidTransaction` inserts RETURN inventory_movement atomically with journal reversal | Integration | `pnpm --filter @k21/api test` — `void.test.ts` | Wave 0 gap |
| POS-06 | Void without mandatory reason is rejected (Zod validation error) | Unit | `pnpm --filter @k21/api test` — `void.test.ts` | Wave 0 gap |
| POS-06 | Void writes record to `audit_logs` table | Integration | `pnpm --filter @k21/api test` — `void.test.ts` | Wave 0 gap |
| POS-07 | PWA service worker registered + static assets precached | Manual / Lighthouse | Chrome DevTools → Application → Service Workers | N/A |
| POS-08 | Offline transaction written to Dexie `offlineQueue` with status 'pending' | Unit (sync manager) | Frontend unit test | Wave 0 gap |
| POS-08 | After offline sale, `productCache` stockQty decremented for sold variants | Unit (sync manager) | Frontend unit test | Wave 0 gap |
| POS-09 | `syncOfflineTx` returns `alreadySynced: true` on duplicate `client_uuid` | Integration | `pnpm --filter @k21/api test` — `pos.test.ts` | Wave 0 gap |
| POS-09 | Sync manager removes item from `offlineQueue` after successful sync | Unit | Frontend unit test | Wave 0 gap |
| POS-10 | Sync endpoint returns `conflictFlag: true` when variant stock is 0 | Integration | `pnpm --filter @k21/api test` — `pos.test.ts` | Wave 0 gap |
| POS-10 | Conflicted transaction stored in Dexie `syncConflicts` table | Unit | Frontend unit test | Wave 0 gap |
| POS-11 | `completeSale` inserts inventory_movement(SALE) + transaction + journal_entry in one DB transaction | Integration | `pnpm --filter @k21/api test` — `pos.test.ts` | Wave 0 gap |
| POS-11 | `completeSale` rolls back all inserts if INSUFFICIENT_STOCK for any item | Integration | `pnpm --filter @k21/api test` — `pos.test.ts` | Wave 0 gap |

### Manual-Only Tests

| Scenario | Why Manual | How to Test |
|----------|-----------|-------------|
| POS-04 Thermal print | Requires physical 58mm/80mm USB thermal printer | Connect printer in Chrome; click "Connect Printer"; complete a sale; verify receipt printout layout |
| POS-07 PWA offline mode | Requires Chrome DevTools offline simulation | DevTools → Network → Offline; navigate to /pos; confirm UI loads and transactions can be entered |
| POS-07 Service worker update flow | Requires live deployment | Deploy update; confirm new SW activates without manual refresh (skipWaiting: true behavior) |
| POS-04 WhatsApp share | Requires mobile device or WhatsApp Web | Tap "Share Receipt"; confirm WhatsApp opens with correct pre-filled text |

### Sampling Rate

- **Per task commit:** `pnpm --filter @k21/api test` — full API unit suite (expected ~15–20 seconds)
- **Per wave merge:** `pnpm --filter @k21/api test:coverage` — with coverage report
- **Phase gate:** Full API suite green + manual PWA/offline checklist signed off before `/gsd:verify-work`

### Wave 0 Gaps

Test stubs and infrastructure required in Plan 03-01 before implementation:

- [ ] `apps/api/src/modules/pos/pos.test.ts` — RED stubs for POS-01, POS-02, POS-03, POS-09, POS-10, POS-11
- [ ] `apps/api/src/modules/shifts/shifts.test.ts` — RED stubs for POS-05
- [ ] `apps/api/src/modules/void/void.test.ts` — RED stubs for POS-06
- [ ] `apps/web/lib/pos/__tests__/cart.utils.test.ts` — pure function tests for POS-02 discount calculations
- [ ] `apps/web/lib/receipt/__tests__/whatsapp.test.ts` — URL builder test for POS-04
- [ ] `apps/web/lib/sync/__tests__/sync.manager.test.ts` — offline queue drain tests for POS-08, POS-09
- [ ] Frontend test runner setup in `apps/web` — `vitest` + `@testing-library/react` needed; no test runner configured yet

---

## Sources

### Primary (HIGH confidence)

- [Serwist Getting Started](https://serwist.pages.dev/docs/next/getting-started) — installation command, next.config setup, sw.ts template, tsconfig additions, .gitignore additions
- [@serwist/next npm — v9.5.6 current stable](https://www.npmjs.com/package/@serwist/next)
- [serwist npm — v9.5.7 current stable](https://www.npmjs.com/package/serwist)
- [Dexie.js Download](https://dexie.org/docs/Download) — npm install, TypeScript class-based schema pattern, v4 confirmed stable
- [WebSerialReceiptPrinter GitHub](https://github.com/NielsLeenheer/WebSerialReceiptPrinter) — connection lifecycle, print API, reconnect behavior
- [@point-of-sale/webserial-receipt-printer npm](https://www.npmjs.com/package/@point-of-sale/webserial-receipt-printer)
- `apps/api/src/modules/inventory/movement.service.ts` — existing `decrementStock()` and `recordMovement()` patterns for POS-11
- `apps/api/src/middleware/audit.ts` — existing `logAudit()` signature for POS-06
- `apps/api/src/db/schema/inventory.ts` — existing Drizzle schema patterns for new POS tables

### Secondary (MEDIUM confidence)

- [Offline-first frontend apps in 2025 — LogRocket](https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/) — Background Sync cross-browser status (Chromium-only as of 2025), `online` event as universally supported alternative
- [Zustand Next.js 14 discussion #2426](https://github.com/pmndrs/zustand/discussions/2426) — App Router store provider pattern; `skipHydration` for async stores
- [Building Offline Apps with Next.js and Serwist — DEV Community](https://dev.to/sukechris/building-offline-apps-with-nextjs-and-serwist-2cbj) — real-world Serwist + Next.js App Router example

### Tertiary (LOW confidence — marked for validation)

- ESC/POS 58mm column width = 32 chars, 80mm = 48 chars — community knowledge; verify against specific printer model docs before implementing column-alignment logic in receipt encoder
- [Zustand persist + IndexedDB timing issue](https://github.com/pmndrs/zustand/discussions/1721) — recommendation to use Dexie directly for offline queue (rather than Zustand persist) is based on this thread; specific behavior may vary by Zustand version

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on npm with current versions; Serwist official docs fetched directly
- Architecture patterns: HIGH — POS backend patterns mirror Phase 2 proven code; Dexie and Serwist usage verified against official docs
- Offline sync strategy: HIGH — `online` event + Dexie queue is well-documented; idempotency via UNIQUE constraint is standard DB practice
- Thermal printing: MEDIUM — Web Serial API browser support verified (Chromium required); column width values (58mm=32, 80mm=48) are LOW confidence pending printer-specific testing
- Pitfalls: HIGH — PgBouncer TRANSACTION mode pitfall is documented in STATE.md from Phase 2 experience; others verified against official browser security docs

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable libraries; Serwist and Dexie APIs are stable; re-verify if more than 30 days elapse)
