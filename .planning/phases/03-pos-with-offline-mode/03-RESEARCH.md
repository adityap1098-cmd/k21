# Phase 3: POS with Offline Mode - Research

**Researched:** 2026-03-18
**Domain:** PWA offline-first POS — IndexedDB sync, ESC/POS thermal printing, Serwist service workers, cart state management, shift management, atomic DB transactions
**Confidence:** HIGH (core stack), MEDIUM (ESC/POS Web Serial integration details), HIGH (offline sync pattern)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**POS Screen Layout**
- Split-screen: Left panel = product discovery (search/scan + quick-add grid); Right panel = cart + totals + payment button
- Everything visible at once — no navigation between product search and cart

**Cart & Discounts**
- Item-level discounts: Tap a cart line → inline expand with quantity edit + discount field (percentage or flat Rp). No modal.
- Transaction-level discount: Separate discount field on cart totals area, applied to whole transaction
- Both stored independently

**Payment UX**
- Cash: Cashier enters amount tendered; system calculates change. Quick-select buttons: Rp50k, Rp100k, Rp200k
- QRIS: Manual confirmation — cashier selects QRIS, customer scans static merchant QR, cashier taps "Payment Received". No gateway API. Works offline.
- Bank Transfer: Manual confirmation — cashier records bank name + optional reference, confirms receipt manually. Works offline.
- Split payment: Supported — multiple payment legs recorded separately (e.g., Rp150k cash + Rp50k transfer)
- Payment method selection is the last step before completing the transaction

**Offline Mode & Sync**
- PWA with `@serwist/next` (locked from Phase 0) — Service Worker + IndexedDB
- Product catalog cache: Full active product + variant catalog synced to IndexedDB. Stock shown offline is "last known" with staleness warning.
- Cache refresh: Full sync on shift open / page load; background refresh every 15 minutes while online
- Transaction queue: Offline transactions written to IndexedDB with `client_uuid` (idempotency key), synced when online
- Auto-sync on reconnect: SW detects network restored → queued transactions submitted in background. Status indicator shown to cashier.
- Stock conflict handling: Server flags conflict (stock went to 0). NOT auto-voided. Placed in "Sync Issues" list. Cashier or Owner can Approve (force-complete, stock may go negative, conflict note in movement) or Void (reason required). Both actions written to `audit_logs`.

**Receipt Generation**
- Thermal print: ESC/POS via browser Web Serial API. Supports 58mm and 80mm.
- Digital receipt: "Share Receipt" button opens pre-filled WhatsApp URL (`wa.me/?text=...`). No backend required.
- Receipt content: store name, transaction ID, date/time, cashier name, itemized list (name + qty + unit price + item discount), transaction discount, subtotal, tax (PPN if applicable), total, payment breakdown (method + amount per leg), change due (for cash), shift ID.

**Shift Management**
- One shift per cashier per session. Cannot start new shift while one is open.
- Open shift: cashier records opening cash float. Records shift_open timestamp, cashier ID, float amount.
- Close shift: cashier counts physical cash, enters actual amount. System generates reconciliation report (opening float, total sales per payment method, expected cash, actual cash, discrepancy).

**Transaction Void**
- Void requires mandatory reason (free text)
- Void audit-logged (user, reason, timestamp, original transaction ID)
- Stock restored via new `inventory_movement(RETURN)` record — append-only maintained
- Journal entry reversal created in same atomic transaction as stock restore

**Tech Stack (all locked)**
- Backend: Express.js + TypeScript + Drizzle ORM + postgres.js + BullMQ + Redis
- Frontend: Next.js 14 App Router + `@serwist/next` + IndexedDB
- Monorepo: pnpm workspaces, apps/api + apps/web + packages/shared
- TypeScript NodeNext ESM — explicit `.js` extensions on relative imports
- Module pattern: `apps/api/src/modules/{domain}/` with service + router + tests + barrel

### Claude's Discretion
- Quick-add grid: which products appear by default and how cashier customizes it
- ESC/POS library choice (e.g., `@point-of-sale/receipt-printer-encoder` + `@point-of-sale/webserial-receipt-printer`)
- IndexedDB schema and version management (e.g., Dexie.js or raw IDB API)
- Exact Service Worker caching strategy (cache-first for static assets, network-first for API)
- PPN tax display logic on receipt (whether to show inclusive/exclusive)
- Exact UI for "Sync Issues" list — modal, sidebar, or dedicated page

### Deferred Ideas (OUT OF SCOPE)
- QRIS/payment gateway integration (Midtrans, Xendit) — future phase
- Customer management / loyalty points — separate phase
- Online queue / booking system — separate phase
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| POS-01 | Kasir dapat scan barcode produk atau cari manual untuk tambah ke cart | Product catalog sync to IndexedDB; barcode input via HTML input with camera/hardware scanner support; search by name with Dexie.js index queries |
| POS-02 | Kasir dapat tambah, kurangi, hapus item di cart, dan terapkan diskon per item | Zustand cart store with immutable reducer pattern; inline discount field (percentage/flat); cart totals calculation functions |
| POS-03 | Transaksi mendukung multi-payment: tunai, transfer bank, dan QRIS | Split payment legs array on transaction; manual confirmation flow for all three; change calculation for cash; `POST /api/v1/pos/transactions` accepts `payments[]` array |
| POS-04 | Setiap transaksi selesai menghasilkan receipt (cetak dan/atau digital) | `@point-of-sale/receipt-printer-encoder` + `@point-of-sale/webserial-receipt-printer` for thermal; `wa.me/?text=` URL for WhatsApp digital receipt |
| POS-05 | Kasir dapat membuka dan menutup shift dengan rekap total transaksi dan selisih kas | `shifts` table with cashier_id, float, open/close timestamps; reconciliation computed from transactions in shift; `POST /api/v1/shifts/open` + `/close` |
| POS-06 | Kasir dapat void/cancel transaksi yang sudah selesai (dengan alasan, tercatat di audit log) | `VOID` status on transactions table; `RETURN` inventory_movement; journal entry reversal; logAudit helper already exists |
| POS-07 | POS berjalan sebagai PWA dengan Service Worker — aset ter-cache untuk offline access | `@serwist/next` with `app/sw.ts` precache + defaultCache runtime caching; `app/manifest.json` required |
| POS-08 | Transaksi yang dibuat saat offline tersimpan di IndexedDB browser | Dexie.js `offlineQueue` table with `status: 'pending'/'synced'/'conflict'`; client_uuid generated at creation |
| POS-09 | Saat koneksi pulih, transaksi offline auto-sync ke server dengan idempotency key (client_uuid) — tidak ada duplikasi | `online` event listener + service worker background sync; server uses `ON CONFLICT (client_uuid) DO NOTHING`; retry sequential queue |
| POS-10 | Server memvalidasi stok saat sync transaksi offline; konflik diflag untuk resolusi kasir | Sync endpoint returns `{ status: 'conflict', ... }` when stock insufficient; IndexedDB record updated to status 'conflict'; Sync Issues UI |
| POS-11 | Setiap transaksi POS selesai otomatis menghasilkan `inventory_movement(SALE)` dan `journal_entry` dalam satu atomic DB transaction | `db.transaction()` wrapping `decrementStock()` + `createJournalEntryStub()` + `insert(transactions)`; Phase 7 accounting stub interface |
</phase_requirements>

---

## Summary

Phase 3 is the most technically complex phase in this project to date. It combines three distinct engineering challenges: (1) an atomic server-side transaction that must link sale records, inventory movements, and a journal entry stub in a single PostgreSQL transaction; (2) an offline-first PWA that stores transactions in IndexedDB when the network is unavailable and syncs them idempotently on reconnect; and (3) browser-based thermal receipt printing via the Web Serial API.

The offline sync pattern is the highest-risk area. The Background Sync API is only reliably available in Chromium-based browsers; Firefox does not support it and Safari does not implement it. The fallback — `window.addEventListener('online', ...)` triggering a sync sweep — must be the primary mechanism, with Background Sync as a progressive enhancement. The idempotency guarantee comes from a `client_uuid` column with a UNIQUE constraint on the server-side transactions table, so duplicate sync submissions silently no-op via `ON CONFLICT (client_uuid) DO NOTHING`.

The Serwist PWA layer is the `@serwist/next` package (locked in Phase 0), which was not yet installed in `apps/web/package.json` at the time of this research. Phase 3 must install and configure it. The STATE.md flagged this as HIGH RISK and recommended a proof-of-concept spike; this research confirms that the Serwist setup is well-documented and stable for Next.js 14 App Router, reducing that risk to MEDIUM.

**Primary recommendation:** Build the API layer (transactions, shifts, sync endpoint) first with full tests. Then build the Zustand cart store and POS UI. Install Serwist and Dexie.js last, in a dedicated offline wave. This wave order prevents Serwist cache interference from polluting API integration tests.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@serwist/next` | latest (^9.x) | PWA service worker integration for Next.js App Router | Locked in Phase 0; the only actively maintained PWA solution for App Router |
| `serwist` | latest (^9.x, peer dep) | Workbox-based SW runtime caching engine | Required peer dependency of @serwist/next |
| `dexie` | ^4.0 | IndexedDB wrapper for offline queue and catalog cache | TypeScript-native, React hooks via dexie-react-hooks, clean schema versioning API |
| `dexie-react-hooks` | ^4.x | `useLiveQuery` hook for reactive IndexedDB reads | Eliminates manual useEffect for live cart/queue status |
| `zustand` | ^4.x | Cart state management (in-memory, not persisted to IndexedDB) | Minimal, no-provider-needed, immutable slice pattern, well-tested with Next.js App Router |
| `@point-of-sale/receipt-printer-encoder` | ^3.0 | Encode receipt content to ESC/POS byte commands | Maintained by Niels Leenheer; the current canonical ESC/POS encoder for browser use; replaces deprecated `esc-pos-encoder` |
| `@point-of-sale/webserial-receipt-printer` | latest | Web Serial API transport for receipt bytes | Sister library by same author; handles connect/reconnect/print lifecycle |
| `zod` | ^3.x (already installed) | Request validation on sync endpoint | Already in API dependencies |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `uuid` (browser `crypto.randomUUID()`) | native | Generate `client_uuid` for offline transactions | No install needed; available in all modern browsers and Node 18+ |
| `@types/web` | dev dep via tsconfig | Web Serial API TypeScript types | Required when writing Web Serial code in TypeScript |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `dexie` | raw IndexedDB API | Raw IDB is verbose and error-prone; Dexie provides clean schema versioning and TypeScript generics |
| `dexie` | `idb` (lightweight wrapper) | `idb` has no schema versioning or query builder; Dexie is more complete for this use case |
| `zustand` | React Context + useReducer | Context causes full subtree re-renders on every cart change; Zustand slices isolate updates |
| `@point-of-sale/receipt-printer-encoder` | `thermal-printer-encoder` v3 | `thermal-printer-encoder` is stale (last published ~1 year ago); `@point-of-sale/receipt-printer-encoder` is the actively maintained successor by the same author |
| Web Serial API | WebUSB | Web Serial works with more USB-to-serial adapters and serial-native printers; broader device compatibility |

**Installation:**
```bash
# apps/web
pnpm --filter @k21/web add @serwist/next serwist dexie dexie-react-hooks zustand @point-of-sale/receipt-printer-encoder @point-of-sale/webserial-receipt-printer
# (no new API dependencies — zod, drizzle, postgres already installed)
```

---

## Architecture Patterns

### Recommended Project Structure

```
apps/api/src/modules/
├── pos/
│   ├── pos.service.ts          # completeSale(), voidTransaction(), syncOfflineTx()
│   ├── pos.router.ts           # POST /transactions, POST /transactions/:id/void, POST /transactions/sync
│   ├── pos.test.ts             # unit tests with DB mocks
│   └── index.ts                # barrel export
├── shifts/
│   ├── shifts.service.ts       # openShift(), closeShift(), getShiftReconciliation()
│   ├── shifts.router.ts        # POST /shifts/open, POST /shifts/close, GET /shifts/:id/reconciliation
│   ├── shifts.test.ts
│   └── index.ts
│
apps/api/src/db/schema/
├── pos.ts                      # transactions, transaction_items, transaction_payments, shifts tables
│                               # + journal_entries stub table (minimal, Phase 7 fills in logic)
│
apps/web/src/
├── app/
│   ├── sw.ts                   # Serwist service worker entry
│   ├── manifest.json           # PWA manifest
│   └── pos/
│       └── page.tsx            # Split-screen POS page (Server Component wrapper → Client Components)
├── lib/
│   ├── db/
│   │   └── offline-db.ts       # Dexie.js database definition (offlineQueue, catalogCache)
│   ├── store/
│   │   ├── cart.store.ts       # Zustand cart slice
│   │   └── shift.store.ts      # Zustand active shift slice
│   └── receipt/
│       ├── encoder.ts          # ESC/POS encoding helper (wraps ReceiptPrinterEncoder)
│       ├── webserial.ts        # Web Serial printer connect/print helper
│       └── whatsapp.ts         # wa.me URL builder
└── components/pos/
    ├── ProductPanel.tsx         # Left panel: search + barcode + quick-add grid
    ├── CartPanel.tsx            # Right panel: cart lines + totals + pay button
    ├── PaymentModal.tsx         # Payment method selection + confirmation
    ├── ReceiptModal.tsx         # Post-sale: print + share buttons
    ├── ShiftDrawer.tsx          # Open/close shift UI
    └── SyncStatusBar.tsx        # "Syncing N transactions..." indicator
```

### Pattern 1: Atomic Sale Transaction (POS-11)

**What:** Single `db.transaction()` that inserts the sale record, writes `inventory_movement(SALE)` for each line item via `decrementStock()`, and writes a `journal_entry` stub row. All three either commit together or roll back together.

**When to use:** Every time `POST /api/v1/pos/transactions` is called (online) or the sync endpoint processes a queued transaction.

```typescript
// Source: established in apps/api/src/modules/inventory/movement.service.ts
// POS extends the same db.transaction() pattern

export async function completeSale(params: CompleteSaleParams, tx?: DrizzleTx): Promise<Transaction> {
  // Must run in a single db.transaction() call
  return await db.transaction(async (tx) => {
    // 1. Insert transaction header
    const [transaction] = await tx.insert(transactions).values({
      id: randomUUID(),
      clientUuid: params.clientUuid,      // idempotency key
      shiftId: params.shiftId,
      cashierId: params.cashierId,
      subtotal: params.subtotal,
      discountAmount: params.discountAmount,
      total: params.total,
      status: 'COMPLETED',
      createdAt: new Date(),
    }).returning()

    // 2. Insert line items
    await tx.insert(transactionItems).values(params.items.map(item => ({
      id: randomUUID(),
      transactionId: transaction.id,
      variantId: item.variantId,
      qty: item.qty,
      unitPrice: item.unitPrice,
      discountAmount: item.discountAmount,
      lineTotal: item.lineTotal,
    })))

    // 3. Insert payment legs
    await tx.insert(transactionPayments).values(params.payments.map(p => ({
      id: randomUUID(),
      transactionId: transaction.id,
      method: p.method,            // 'CASH' | 'TRANSFER' | 'QRIS'
      amount: p.amount,
      reference: p.reference,      // bank ref for TRANSFER
    })))

    // 4. Decrement stock for each line (SELECT FOR UPDATE inside, via recordMovement)
    for (const item of params.items) {
      await recordMovement({
        variantId: item.variantId,
        movementType: 'SALE',
        qty: item.qty,
        reference: transaction.id,
        performedBy: params.cashierId,
      }, tx)
      await tx.execute(
        sql`UPDATE product_variants SET stock_qty = stock_qty - ${item.qty}, updated_at = now()
            WHERE id = ${item.variantId}`
      )
    }

    // 5. Journal entry stub (Phase 7 fills in the double-entry logic)
    await createJournalEntryStub({ transactionId: transaction.id, total: params.total }, tx)

    return transaction
  })
}
```

**Key constraint:** `recordMovement()` already accepts an optional `tx` parameter (confirmed in `movement.service.ts`). POS uses it in `tx` mode so it participates in the same PostgreSQL transaction.

### Pattern 2: Idempotent Sync Endpoint (POS-09)

**What:** The offline sync endpoint accepts a `client_uuid` and uses PostgreSQL `ON CONFLICT` to ensure duplicate submissions are no-ops.

**When to use:** `POST /api/v1/pos/transactions/sync` called by the front-end sync sweep.

```typescript
// Migration SQL — add UNIQUE constraint on transactions.client_uuid
ALTER TABLE transactions ADD CONSTRAINT transactions_client_uuid_unique UNIQUE (client_uuid);

// In pos.service.ts syncOfflineTx()
// Insert with ON CONFLICT DO NOTHING; if no row inserted, it was a duplicate
const result = await tx.execute(
  sql`INSERT INTO transactions (..., client_uuid) VALUES (..., ${params.clientUuid})
      ON CONFLICT (client_uuid) DO NOTHING
      RETURNING id`
)
if (result.length === 0) {
  // Duplicate — already processed; return existing transaction
  return await getTransactionByClientUuid(params.clientUuid)
}
// ... proceed with stock decrement and journal entry
```

### Pattern 3: Dexie.js Offline Queue (POS-08)

**What:** All transactions created offline are written to IndexedDB with a `status` field. The sync loop processes `pending` records sequentially.

```typescript
// Source: Dexie.js v4 documentation pattern
// apps/web/src/lib/db/offline-db.ts

import Dexie, { type Table } from 'dexie'

export interface OfflineTransaction {
  clientUuid: string          // primary key
  status: 'pending' | 'synced' | 'conflict'
  payload: object             // full CompleteSaleParams
  createdAt: number           // Date.now()
  syncedAt?: number
  conflictDetail?: string
}

export interface CatalogProduct {
  variantId: string           // primary key
  productId: string
  name: string
  sku: string
  barcode?: string
  price: number
  stockQty: number            // "last known" — stale when offline
  lastSyncedAt: number
}

class OfflineDB extends Dexie {
  offlineQueue!: Table<OfflineTransaction>
  catalog!: Table<CatalogProduct>

  constructor() {
    super('k21-pos')
    this.version(1).stores({
      offlineQueue: 'clientUuid, status, createdAt',
      catalog: 'variantId, barcode, name',  // index barcode + name for search
    })
  }
}

export const offlineDB = new OfflineDB()
```

### Pattern 4: Online/Offline Sync Loop (POS-09)

**What:** Front-end sync manager that fires on `online` event and processes the queue sequentially.

**CRITICAL NOTE:** The Background Sync API (SyncManager) is only supported in Chromium browsers. Firefox has it disabled; Safari does not implement it. Use `window.addEventListener('online', ...)` as the primary mechanism. Register a Background Sync event as a progressive enhancement only.

```typescript
// apps/web/src/lib/sync-manager.ts
export async function syncPendingTransactions(): Promise<SyncResult[]> {
  const pending = await offlineDB.offlineQueue
    .where('status').equals('pending')
    .sortBy('createdAt')  // process in creation order

  const results: SyncResult[] = []
  for (const tx of pending) {
    try {
      const res = await fetch('/api/v1/pos/transactions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx.payload),
      })
      const data = await res.json()
      if (data.status === 'conflict') {
        await offlineDB.offlineQueue.update(tx.clientUuid, {
          status: 'conflict',
          conflictDetail: data.message,
        })
      } else {
        await offlineDB.offlineQueue.update(tx.clientUuid, {
          status: 'synced',
          syncedAt: Date.now(),
        })
      }
      results.push(data)
    } catch {
      // Network error — leave as 'pending', will retry next time
      break
    }
  }
  return results
}

// In a React hook or useEffect:
useEffect(() => {
  const handleOnline = () => syncPendingTransactions()
  window.addEventListener('online', handleOnline)
  // Also fire on mount if already online (handles "came back while tab was in background")
  if (navigator.onLine) syncPendingTransactions()
  return () => window.removeEventListener('online', handleOnline)
}, [])
```

### Pattern 5: Serwist Configuration for Next.js 14 App Router

**What:** PWA setup with Serwist, precaching Next.js assets and providing an offline fallback page.

```typescript
// Source: https://serwist.pages.dev/docs/next/getting-started
// next.config.ts
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',  // IMPORTANT: disable in dev to avoid cache hell
  reloadOnOnline: true,
})

export default withSerwist({
  output: 'standalone',
  transpilePackages: ['@k21/shared'],
})

// src/app/sw.ts
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

**tsconfig.json additions for `apps/web`:**
```json
{
  "compilerOptions": {
    "types": ["@serwist/next/typings"],
    "lib": ["dom", "dom.iterable", "esnext", "webworker"]
  },
  "exclude": ["public/sw.js"]
}
```

### Pattern 6: ESC/POS Receipt Printing

**What:** Two-library approach: encode with `@point-of-sale/receipt-printer-encoder`, transport with `@point-of-sale/webserial-receipt-printer`.

```typescript
// Source: https://github.com/NielsLeenheer/ReceiptPrinterEncoder
// Source: https://github.com/NielsLeenheer/WebSerialReceiptPrinter
// apps/web/src/lib/receipt/encoder.ts

import ReceiptPrinterEncoder from '@point-of-sale/receipt-printer-encoder'

export function encodeReceipt(data: ReceiptData, width: 58 | 80 = 80): Uint8Array {
  const cols = width === 58 ? 32 : 48
  const encoder = new ReceiptPrinterEncoder({ columns: cols })
  return encoder
    .initialize()
    .align('center')
    .bold(true).line(data.storeName).bold(false)
    .line(data.transactionId)
    .line(data.dateTime)
    .rule()
    .align('left')
    // ... itemized lines
    .rule()
    .line(`TOTAL: Rp ${data.total.toLocaleString('id-ID')}`)
    .newline().newline().newline()  // feed for tear-off
    .encode()
}

// apps/web/src/lib/receipt/webserial.ts
import WebSerialReceiptPrinter from '@point-of-sale/webserial-receipt-printer'

let printer: WebSerialReceiptPrinter | null = null

export async function connectPrinter(): Promise<void> {
  printer = new WebSerialReceiptPrinter()
  // Must be called from a user gesture (click handler)
  await printer.connect()
}

export async function printReceipt(encodedBytes: Uint8Array): Promise<void> {
  if (!printer) throw new Error('PRINTER_NOT_CONNECTED')
  await printer.print(encodedBytes)
}
```

### Pattern 7: WhatsApp Digital Receipt

**What:** URL share — no backend needed, works offline immediately after transaction.

```typescript
// apps/web/src/lib/receipt/whatsapp.ts
export function buildWhatsAppUrl(data: ReceiptData): string {
  const lines = [
    `*${data.storeName}*`,
    `Struk: ${data.transactionId}`,
    `${data.dateTime}`,
    `Kasir: ${data.cashierName}`,
    '',
    ...data.items.map(i => `${i.name} x${i.qty}  Rp ${i.lineTotal.toLocaleString('id-ID')}`),
    '',
    `Total: Rp ${data.total.toLocaleString('id-ID')}`,
    ...data.payments.map(p => `${p.method}: Rp ${p.amount.toLocaleString('id-ID')}`),
  ]
  const text = encodeURIComponent(lines.join('\n'))
  // wa.me without phone number opens WhatsApp with contact picker
  return `https://wa.me/?text=${text}`
}
```

### Pattern 8: Zustand Cart Store

**What:** Immutable cart state with typed actions. Cart lives entirely in memory (not persisted to IndexedDB — a fresh cart is created each transaction).

```typescript
// apps/web/src/lib/store/cart.store.ts
import { create } from 'zustand'

interface CartItem {
  variantId: string
  name: string
  qty: number
  unitPrice: number
  discountType: 'percent' | 'flat'
  discountValue: number
}

interface CartState {
  items: CartItem[]
  transactionDiscount: number       // flat Rp discount on whole transaction
  addItem: (item: Omit<CartItem, 'qty' | 'discountType' | 'discountValue'>) => void
  updateQty: (variantId: string, qty: number) => void
  setItemDiscount: (variantId: string, type: 'percent' | 'flat', value: number) => void
  setTransactionDiscount: (amount: number) => void
  removeItem: (variantId: string) => void
  clearCart: () => void
}

// Computed from state (not stored):
export function computeCartTotals(items: CartItem[], txDiscount: number) {
  const subtotal = items.reduce((sum, item) => {
    const lineBase = item.unitPrice * item.qty
    const itemDisc = item.discountType === 'percent'
      ? lineBase * (item.discountValue / 100)
      : item.discountValue
    return sum + lineBase - itemDisc
  }, 0)
  const total = Math.max(0, subtotal - txDiscount)
  return { subtotal, total }
}
```

### Pattern 9: Journal Entry Stub (Phase 7 Interface)

**What:** Phase 3 creates the `journal_entries` table and the `createJournalEntryStub()` function. The function inserts a minimal row that Phase 7 will expand with full double-entry logic. This satisfies the ROADMAP dependency: "Accounting stub must exist in Phase 3 before full implementation in Phase 7."

```typescript
// apps/api/src/db/schema/accounting.ts (new in Phase 3)
export const journalEntries = pgTable('journal_entries', {
  id:            uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').notNull(),  // FK to transactions.id
  sourceType:    varchar('source_type', { length: 50 }).notNull(),  // 'POS_SALE' | 'VOID'
  amount:        integer('amount').notNull(),        // total in Rp (cents or Rp integer)
  status:        varchar('status', { length: 20 }).notNull().default('PENDING'),
  // Phase 7 will add: debit_account_id, credit_account_id, journal_lines[], etc.
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// In pos.service.ts
export async function createJournalEntryStub(
  params: { transactionId: string; total: number },
  tx: DrizzleTx
): Promise<void> {
  await (tx as any).insert(journalEntries).values({
    id: randomUUID(),
    transactionId: params.transactionId,
    sourceType: 'POS_SALE',
    amount: params.total,
    status: 'PENDING',
    createdAt: new Date(),
  })
}
```

### Anti-Patterns to Avoid

- **Storing cart state in IndexedDB:** Cart is ephemeral — lives in Zustand only. IndexedDB is for completed transactions that need to survive page refresh.
- **Calling decrementStock() outside a db.transaction():** The existing `decrementStock()` function opens its own transaction — do NOT call it inside an outer `db.transaction()` from POS, as PgBouncer transaction mode does not support nested transactions. Instead, use the inner `recordMovement()` + `UPDATE product_variants` pattern directly inside the outer transaction.
- **Enabling Serwist in development:** Cache hell during development makes debugging extremely difficult. Always `disable: process.env.NODE_ENV === 'development'`.
- **Relying on Background Sync API alone:** It is not supported by Firefox or Safari. Always have the `online` event listener as the primary sync trigger.
- **Auto-voiding conflicts:** Do not auto-void offline transactions with stock conflicts. The user context (CONTEXT.md) explicitly requires human review — goods may already be in the customer's hands.
- **Using `db.transaction()` inside `db.transaction()` with PgBouncer:** PgBouncer TRANSACTION pool mode does not support nested transactions / SAVEPOINTs with postgres.js. The POS sale must use a single flat transaction.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB schema versioning | Custom migration runner | `dexie` schema versioning | Dexie handles upgrade migrations, blocked events, and version conflicts automatically |
| ESC/POS byte encoding | Custom bitstream builder | `@point-of-sale/receipt-printer-encoder` | ESC/POS has dozens of commands, charset handling, and printer quirks — hand-rolling is months of work |
| Web Serial device connection | Custom Serial API wrapper | `@point-of-sale/webserial-receipt-printer` | Handles reconnect-to-last-device, baud rate negotiation, buffer management |
| Cart totals recalculation | Custom memoization | `computeCartTotals()` pure function called on render | Pure functions are simpler than custom memoization; React re-render cost is negligible for POS cart sizes |
| UUID generation | Custom ID | `crypto.randomUUID()` (browser/Node native) | No library needed; available in all target environments |
| Duplicate transaction prevention | Server-side dedup logic | PostgreSQL `ON CONFLICT (client_uuid) DO NOTHING` | DB-level constraint is the only reliable guarantee; application-level checks have race conditions |

**Key insight:** The ESC/POS ecosystem is deeply non-obvious — character encoding, paper width column counts, cut commands, and printer-specific quirks require battle-tested libraries. Do not attempt to hand-roll receipt encoding.

---

## Common Pitfalls

### Pitfall 1: Nested Transaction with decrementStock()
**What goes wrong:** Calling the existing `decrementStock()` function (which opens its own `db.transaction()`) inside the POS sale transaction causes a runtime error with PgBouncer in TRANSACTION mode — nested BEGIN/COMMIT pairs are not supported.
**Why it happens:** `decrementStock()` was designed as a standalone operation; POS needs to compose it with other inserts atomically.
**How to avoid:** Inside the POS `db.transaction()` callback, call `recordMovement(..., tx)` and manually `UPDATE product_variants ... WHERE id = ... FOR UPDATE` directly — the same logic that `decrementStock()` does, but with the outer `tx` instead of opening a new one.
**Warning signs:** `cannot begin/commit transactions in the middle of a transaction` error in PgBouncer logs.

### Pitfall 2: Serwist Cache Hell in Development
**What goes wrong:** Service Worker caches API responses and Next.js bundles. Hot reload stops working. Old cached responses served for new API contracts.
**Why it happens:** Serwist precaches the Next.js build manifest; in dev mode the build hash changes every save.
**How to avoid:** Always set `disable: process.env.NODE_ENV === 'development'` in `withSerwistInit()`. Only enable for PWA testing with a production build.
**Warning signs:** API changes not reflected in browser; hard refresh required repeatedly.

### Pitfall 3: Web Serial API Permission Scope
**What goes wrong:** `printer.connect()` throws "Must be handling a user gesture" when called outside a click event handler.
**Why it happens:** Web Serial API requires a user gesture (click, touch) before showing the device picker. Calling it on page load or in a useEffect is rejected.
**How to avoid:** Connect button in a UI component, call `connectPrinter()` directly in the `onClick` handler. Store `lastUsedDevice` (vendorId + productId from the `connected` event) in localStorage to auto-reconnect on next visit.
**Warning signs:** `SecurityError: Must be handling a user gesture to show a permission request.`

### Pitfall 4: IndexedDB Schema Version Conflicts
**What goes wrong:** After a Dexie schema version upgrade is deployed, users with old browser caches get a `VersionError` if the version number is incorrect.
**Why it happens:** Dexie requires monotonically increasing integer versions. Skipping or re-using a version number breaks upgrades.
**How to avoid:** Only ever increment the version number. Never remove a version entry once it has been released. Add new tables/indexes as new version entries.
**Warning signs:** `Dexie.VersionError: The requested version (N) is less than the existing version (M)` in console.

### Pitfall 5: Offline Stock Shown as Always Available
**What goes wrong:** Cashier adds 10 units to cart offline while actual stock is 2 (another channel sold it). No error until sync.
**Why it happens:** Offline catalog shows "last known" stock; there is no way to enforce real-time stock checks without connectivity.
**How to avoid:** (a) Display a "last synced X minutes ago" staleness indicator prominently. (b) Catalog cache refreshes on shift open and every 15 minutes while online. (c) At sync time, the server validates stock — conflicts are surfaced for human resolution. Do not try to block the sale offline based on stale stock data.
**Warning signs:** High rate of sync conflicts in the Sync Issues list indicates infrequent cache refreshes.

### Pitfall 6: Shift Not Validated at Transaction Time
**What goes wrong:** Transactions created without an active shift lose the shift association, breaking reconciliation reports.
**Why it happens:** Front-end allows POS use before shift is opened.
**How to avoid:** API route `POST /pos/transactions` must validate that a shift in `OPEN` status exists for the cashier. Front-end should also gate the POS screen behind shift status check. IndexedDB should store the `shiftId` alongside pending transactions.
**Warning signs:** Transactions with `null` shiftId in the database.

### Pitfall 7: tsconfig WebWorker Lib Conflict
**What goes wrong:** Adding `"webworker"` to `lib` in `tsconfig.json` causes type conflicts with `"dom"` — both define `self` differently.
**Why it happens:** `sw.ts` runs in a service worker context (not DOM), but the main app runs in DOM context.
**How to avoid:** Create a separate `tsconfig.sw.json` for `sw.ts` that includes `"webworker"` without `"dom"`. Or rely on `@serwist/next/typings` which handles this automatically. Add `public/sw.js` to `exclude` in `tsconfig.json`.
**Warning signs:** `Cannot find name 'ServiceWorkerGlobalScope'` or `Property 'document' does not exist on type 'ServiceWorkerGlobalScope'`.

---

## Code Examples

### Drizzle Schema: POS Tables

```typescript
// apps/api/src/db/schema/pos.ts
import { pgTable, uuid, varchar, integer, pgEnum, timestamp, boolean } from 'drizzle-orm/pg-core'

export const transactionStatusEnum = pgEnum('transaction_status', ['COMPLETED', 'VOIDED'])
export const paymentMethodEnum = pgEnum('payment_method', ['CASH', 'TRANSFER', 'QRIS'])
export const shiftStatusEnum = pgEnum('shift_status', ['OPEN', 'CLOSED'])

export const shifts = pgTable('shifts', {
  id:            uuid('id').primaryKey().defaultRandom(),
  cashierId:     uuid('cashier_id').notNull(),
  status:        shiftStatusEnum('status').notNull().default('OPEN'),
  openingFloat:  integer('opening_float').notNull(),           // Rp integer
  closingCash:   integer('closing_cash'),                      // null until closed
  openedAt:      timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt:      timestamp('closed_at', { withTimezone: true }),
})

export const transactions = pgTable('transactions', {
  id:              uuid('id').primaryKey().defaultRandom(),
  clientUuid:      varchar('client_uuid', { length: 36 }).notNull().unique(),  // idempotency key
  shiftId:         uuid('shift_id').notNull().references(() => shifts.id),
  cashierId:       uuid('cashier_id').notNull(),
  subtotal:        integer('subtotal').notNull(),
  discountAmount:  integer('discount_amount').notNull().default(0),
  total:           integer('total').notNull(),
  status:          transactionStatusEnum('status').notNull().default('COMPLETED'),
  voidReason:      varchar('void_reason', { length: 500 }),
  voidedAt:        timestamp('voided_at', { withTimezone: true }),
  createdAt:       timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const transactionItems = pgTable('transaction_items', {
  id:             uuid('id').primaryKey().defaultRandom(),
  transactionId:  uuid('transaction_id').notNull().references(() => transactions.id),
  variantId:      uuid('variant_id').notNull(),
  qty:            integer('qty').notNull(),
  unitPrice:      integer('unit_price').notNull(),
  discountAmount: integer('discount_amount').notNull().default(0),
  lineTotal:      integer('line_total').notNull(),
})

export const transactionPayments = pgTable('transaction_payments', {
  id:            uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').notNull().references(() => transactions.id),
  method:        paymentMethodEnum('method').notNull(),
  amount:        integer('amount').notNull(),
  reference:     varchar('reference', { length: 255 }),  // bank ref for TRANSFER
})
```

### Shift Reconciliation Query

```typescript
// In shifts.service.ts
export async function getShiftReconciliation(shiftId: string) {
  const shift = await db.query.shifts.findFirst({ where: eq(shifts.id, shiftId) })
  if (!shift) throw new Error('SHIFT_NOT_FOUND')

  // Sum payments by method for completed (non-voided) transactions in this shift
  const payments = await db.execute(sql`
    SELECT tp.method, SUM(tp.amount) as total
    FROM transaction_payments tp
    JOIN transactions t ON t.id = tp.transaction_id
    WHERE t.shift_id = ${shiftId} AND t.status = 'COMPLETED'
    GROUP BY tp.method
  `)

  const cashSales = payments.find(p => p.method === 'CASH')?.total ?? 0
  const expectedCash = shift.openingFloat + cashSales
  const discrepancy = shift.closingCash != null ? shift.closingCash - expectedCash : null

  return { shift, payments, expectedCash, discrepancy }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-pwa` (abandoned) | `@serwist/next` | 2023 | next-pwa is unmaintained; Serwist is the maintained fork for App Router |
| `esc-pos-encoder` (deprecated) | `@point-of-sale/receipt-printer-encoder` | 2024 | Same author; new package replaces old one |
| Background Sync API as primary sync | `online` event + Background Sync as enhancement | 2024 | Background Sync still unsupported in Firefox and Safari |
| Workbox directly | Serwist (Workbox fork) | 2023-2024 | Serwist is more actively maintained for modern Next.js |
| Raw IndexedDB API | Dexie.js v4 | Ongoing | v4 adds React hooks (useLiveQuery), React Suspense support |

**Deprecated/outdated:**
- `next-pwa`: Do not use — abandoned, does not support Next.js 14 App Router properly
- `esc-pos-encoder` (bare package): Replaced by `@point-of-sale/receipt-printer-encoder`
- `thermal-printer-encoder`: Last published ~1 year ago; same author now maintains `@point-of-sale/receipt-printer-encoder`

---

## Open Questions

1. **PPN display on receipt**
   - What we know: `products.ppnType` field exists from Phase 2 (PROD-03); 11% PPN rate
   - What's unclear: Whether to show PPN as inclusive (already in price) or exclusive (added on top) on the receipt — STATE.md flags PPN rate verification needed in Phase 7
   - Recommendation: For Phase 3, show PPN as inclusive if applicable (no extra charge added). Receipt line: "Incl. PPN 11%". Defer exclusive PPN calculation to Phase 7.

2. **Quick-add grid default product selection**
   - What we know: Grid shows configurable "frequent items" tiles (discretion area)
   - What's unclear: How the initial default set is determined — highest-selling? Manual pin? First N products?
   - Recommendation: Default to the 20 most recently created active products. Add a "pin/unpin" toggle in product search results so cashiers can customize their grid. Store pinned variant IDs in a `cashier_preferences` table or localStorage.

3. **Catalog cache size limits**
   - What we know: Full active product + variant catalog synced to IndexedDB
   - What's unclear: How many SKUs this store has. Stores with 10,000+ variants could hit IndexedDB performance or storage quota issues.
   - Recommendation: For Phase 3, assume < 5,000 variants (typical small retail). No pagination needed. If this becomes an issue, add a delta-sync endpoint in a future phase.

4. **Web Serial API browser limitation**
   - What we know: Web Serial requires a Chromium-based browser (Chrome, Edge, Opera). Firefox and Safari do not support it.
   - What's unclear: Whether the store will use Chrome or if they need broader browser support
   - Recommendation: Document this as a known limitation. Provide fallback: browser `window.print()` dialog (lower quality but universal) if Web Serial is unavailable (`'serial' in navigator` check).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^1.6 (apps/api), no web test framework yet |
| Config file | `apps/api/vitest.config.ts` (existing) |
| Quick run command | `pnpm --filter @k21/api test` |
| Full suite command | `pnpm --filter @k21/api test:coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| POS-01 | Search by name returns matching variants; barcode lookup returns exact variant | unit | `pnpm --filter @k21/api test -- pos.test.ts` | ❌ Wave 0 |
| POS-02 | Cart totals: item discount (% and flat), tx discount, edge case: discount > item price clamps to 0 | unit | `pnpm --filter @k21/api test -- pos.test.ts` | ❌ Wave 0 |
| POS-03 | Multi-payment: sum of payment legs must equal total; split payment recorded as separate rows | unit + integration | `pnpm --filter @k21/api test -- pos.test.ts` | ❌ Wave 0 |
| POS-04 | Receipt encoding: correct line items, totals, change due; WhatsApp URL contains all fields | unit (pure fn) | `pnpm --filter @k21/api test -- pos.test.ts` | ❌ Wave 0 |
| POS-05 | Open shift: one active shift per cashier constraint; close shift: reconciliation totals correct | unit + integration | `pnpm --filter @k21/api test -- shifts.test.ts` | ❌ Wave 0 |
| POS-06 | Void: requires reason; stock restored via RETURN movement; audit log written; journal entry reversal | integration | `pnpm --filter @k21/api test -- pos.test.ts` | ❌ Wave 0 |
| POS-07 | SW registers, precache manifest injected, offline page served | manual E2E | Chrome DevTools → Application → Service Workers | ❌ Manual only |
| POS-08 | Offline transaction written to IndexedDB with status 'pending' and correct client_uuid | unit (Dexie mock) | Browser console / manual | ❌ Manual only |
| POS-09 | Sync: duplicate client_uuid → 200 with original transaction (no new row); queue cleared on success | integration | `pnpm --filter @k21/api test -- pos.test.ts` | ❌ Wave 0 |
| POS-10 | Sync conflict: stock 0 → server returns conflict status; record flagged in IndexedDB | integration | `pnpm --filter @k21/api test -- pos.test.ts` | ❌ Wave 0 |
| POS-11 | Atomic transaction: one sale → one inventory_movement(SALE) per line + one journal_entry stub in same tx; rollback on stock error leaves 0 rows in all tables | integration | `pnpm --filter @k21/api test -- pos.test.ts` | ❌ Wave 0 |

### Nyquist Coverage Detail

**API unit tests (DB-mocked, Vitest pattern established in Phase 2):**
- `pos.test.ts`: completeSale() — payment sum validation, discount edge cases, journal stub creation, audit log for void, idempotent sync
- `shifts.test.ts`: openShift() blocks second open shift, closeShift() reconciliation math

**API integration tests (Supertest + mocked DB):**
- `POST /api/v1/pos/transactions` — 201 created, 400 payment sum mismatch, 400 no active shift, 409 insufficient stock (via decrementStock mock throwing)
- `POST /api/v1/pos/transactions/:id/void` — 200 void with reason, 400 missing reason, 404 not found, 409 already voided
- `POST /api/v1/pos/transactions/sync` — 200 new, 200 idempotent (same client_uuid), 409 conflict (stock 0)
- `POST /api/v1/shifts/open` — 201, 409 already open
- `POST /api/v1/shifts/close` — 200 with reconciliation payload

**Front-end unit tests (pure functions, no framework needed):**
- `computeCartTotals()` — 100% branch coverage: empty cart, item % discount, item flat discount, tx discount, discount > item price
- `buildWhatsAppUrl()` — output contains all receipt fields, URL-encoded
- `encodeReceipt()` — output is Uint8Array (bytes), not empty (cannot assert thermal commands without printer)

**Manual / E2E tests (cannot be automated in CI):**
- POS-07: PWA installability check — Chrome DevTools → Application tab → Manifest valid, SW registered, installable
- POS-08: Offline transaction queue — DevTools → Network → Offline → complete a sale → Application → IndexedDB → offlineQueue table contains 1 pending record
- Thermal printing (POS-04): Requires physical thermal printer — verify 58mm and 80mm layouts print correctly
- WhatsApp share (POS-04): Tap "Share Receipt" → WhatsApp opens with pre-filled text containing all receipt fields
- Online/offline sync round-trip: Offline → create 2 transactions → go online → verify SyncStatusBar shows "Syncing 2" → verify both appear in server transaction list

### Sampling Rate
- **Per task commit:** `pnpm --filter @k21/api test -- pos.test.ts shifts.test.ts`
- **Per wave merge:** `pnpm --filter @k21/api test:coverage`
- **Phase gate:** Full API suite green + manual PWA offline scenario verified before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/src/modules/pos/pos.test.ts` — covers POS-01 through POS-11 API behavior
- [ ] `apps/api/src/modules/shifts/shifts.test.ts` — covers POS-05 shift open/close
- [ ] `apps/api/src/db/schema/pos.ts` — transactions, shifts, transaction_items, transaction_payments tables
- [ ] `apps/api/src/db/schema/accounting.ts` — journal_entries stub table
- [ ] Migration SQL for Phase 3 schema + `client_uuid` UNIQUE constraint

---

## Sources

### Primary (HIGH confidence)
- Serwist official documentation: https://serwist.pages.dev/docs/next/getting-started — installation, next.config, sw.ts template, manifest requirements
- Serwist GitHub: https://github.com/serwist/serwist — configuration options, version details
- ReceiptPrinterEncoder GitHub: https://github.com/NielsLeenheer/ReceiptPrinterEncoder — v3.0.0 API, encoder usage
- WebSerialReceiptPrinter GitHub: https://github.com/NielsLeenheer/WebSerialReceiptPrinter — connect/print API
- Dexie.js official docs: https://dexie.org/docs/Dexie.js — v4.0 current version, schema versioning
- Existing codebase: `apps/api/src/modules/inventory/movement.service.ts` — `recordMovement()` tx parameter pattern confirmed
- Existing codebase: `apps/api/src/middleware/audit.ts` — `logAudit()` helper confirmed available
- Existing codebase: `apps/api/src/db/schema/inventory.ts` — inventoryMovements append-only schema confirmed

### Secondary (MEDIUM confidence)
- MDN: Offline and background operation guide — Background Sync API browser support details (Chromium only)
- LogRocket offline-first 2025 article: https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/ — sync queue schema and idempotency pattern
- npm search results — confirmed `@point-of-sale/receipt-printer-encoder` replaces deprecated `esc-pos-encoder`

### Tertiary (LOW confidence)
- wa.me URL format for WhatsApp share (confirmed from multiple sources, but WhatsApp occasionally changes URL scheme — verify at implementation time)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Serwist, Dexie.js, @point-of-sale libraries all verified via official docs and GitHub; versions confirmed
- Architecture: HIGH — POS atomic transaction pattern is a direct extension of established `decrementStock()` and `recordMovement()` patterns already in codebase
- Offline sync: HIGH — pattern is well-established; key pitfall (Background Sync browser support) verified from MDN
- ESC/POS printing: MEDIUM — library API verified; actual byte output cannot be validated without physical hardware
- Pitfalls: HIGH — nested transaction pitfall verified from existing PgBouncer setup (STATE.md + codebase); others are documented ecosystem gotchas

**Research date:** 2026-03-18
**Valid until:** 2026-06-18 (stable stack; re-verify Serwist version and @point-of-sale library versions before implementation as these are active repos)
