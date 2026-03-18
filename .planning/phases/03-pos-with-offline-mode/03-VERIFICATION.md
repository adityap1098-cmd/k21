---
phase: 03-pos-with-offline-mode
verified: 2026-03-19T01:00:00Z
status: human_needed
score: 11/11 must-haves verified
re_verification: true
  previous_status: gaps_found
  previous_score: 10/11
  gaps_closed:
    - "PaymentModal correctly reads the server transaction ID from the API response after a successful online sale"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Verify full cashier flow end-to-end in a browser"
    expected: >
      1. POS page shows shift gate (Buka Shift) before any shift is open.
      2. After opening a shift, the split-screen renders correctly.
      3. Searching a product name shows catalog results; scanning an exact barcode auto-adds the item.
      4. Cart inline editor expands on tap; percent and flat discounts update the line total.
      5. Clicking BAYAR opens PaymentModal; Rp50k/100k/200k quick-select buttons work;
         change due appears for CASH legs.
      6. Confirming an online payment leads to ReceiptModal showing the real server transaction ID
         (no longer undefined — fix verified at PaymentModal.tsx line 154-155).
      7. WhatsApp button opens wa.me URL in a new tab.
      8. Going offline (DevTools → Network → Offline) and completing a sale writes a pending
         record to IndexedDB (Application → k21-pos → offlineQueue).
      9. Coming back online triggers SyncStatusBar; the pending record is synced and the
         status changes to 'synced' in IndexedDB.
      10. Conflict row in SyncIssuesPanel shows Approve and Void actions for a conflict record.
      11. Shift close reconciliation shows opening float, sales by payment method, expected vs
          actual cash, discrepancy.
    why_human: >
      These are visual, browser-interaction, and real-time network-event behaviors
      that cannot be verified by static analysis or grep.
---

# Phase 3: POS with Offline Mode — Verification Report

**Phase Goal:** Cashiers can complete sales transactions at the counter whether or not the internet is available, and offline transactions sync to the server reliably without duplicates

**Verified:** 2026-03-19
**Status:** human_needed — all automated checks passed; awaiting human browser verification
**Re-verification:** Yes — after gap closure (PaymentModal API response parsing fix)

---

## Re-verification Summary

**Previous status:** gaps_found (10/11)
**Current status:** human_needed (11/11)

**Gap closed:** PaymentModal.tsx line 154–155 now correctly parses the envelope response:

```typescript
// Before (wrong):
const { transactionId } = (await res.json()) as { transactionId: string }

// After (correct — confirmed at line 154–155):
const body = (await res.json()) as { data: { id: string } }
const transactionId = body.data.id
```

The fix matches exactly what was prescribed. `transactionId` is now the server UUID from `body.data.id`, and line 157 correctly overwrites `receiptData.transactionId` with the server value before calling `onSuccess`.

**Regressions:** None. All 10 previously-verified artifacts and key links spot-checked and unchanged.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Drizzle schema for all POS tables exists, compiles, and is exported from schema/index.ts | VERIFIED | `apps/api/src/db/schema/pos.ts` — 4 tables + 3 enums; `accounting.ts` — journalEntries; `index.ts` exports `./pos.js` and `./accounting.js` |
| 2 | Migration SQL creates all tables with UNIQUE constraint on client_uuid | VERIFIED | `apps/api/drizzle/0002_pos_accounting_schema.sql` — 5 CREATE TABLE statements + `CONSTRAINT transactions_client_uuid_unique UNIQUE (client_uuid)` |
| 3 | completeSale() is atomic: stock check + insert + movement + journal entry in one db.transaction() | VERIFIED | `pos.service.ts` line 46 — single `db.transaction(async (tx) => { ... })` block containing FOR UPDATE check, all inserts, `recordMovement(..., tx)`, and `createJournalEntryStub(..., tx)` |
| 4 | completeSale() is idempotent — duplicate clientUuid returns existing transaction | VERIFIED | `pos.service.ts` lines 47–56 — early return on existing clientUuid before any inserts |
| 5 | Shift management gates the POS workflow (open/close with reconciliation) | VERIFIED | `shifts.service.ts` — openShift/closeShift/getActiveShift/getShiftReconciliation all implemented; `pos/page.tsx` shows shift-gate locked screen when `activeShift === null` |
| 6 | voidTransaction() reverses stock, writes RETURN movement, reverses journal entry, logs audit | VERIFIED | `pos.service.ts` lines 315–387 — all four steps in a single db.transaction() |
| 7 | PWA infrastructure: @serwist/next configured, service worker and manifest exist | VERIFIED | `next.config.ts` — withSerwistInit with `disable: process.env.NODE_ENV === 'development'`; `sw.ts` exists with Serwist + defaultCache; `manifest.json` with required fields |
| 8 | Offline transactions saved to IndexedDB; sync fires on reconnect | VERIFIED | `offline-db.ts` — Dexie OfflineDB with offlineQueue (PK: clientUuid); `sync-manager.ts` — startSyncListener registers 'online' event; PaymentModal writes to offlineDB when !navigator.onLine |
| 9 | Sync is idempotent — duplicate clientUuid does not create duplicate records | VERIFIED | syncOfflineTx() calls completeSale() which checks for existing clientUuid before any DB insert; UNIQUE constraint on transactions.client_uuid |
| 10 | Conflict detection and resolution UI exists (SyncIssuesPanel with Approve/Void) | VERIFIED | `SyncIssuesPanel.tsx` — useLiveQuery on offlineQueue where status = 'conflict'; handleForceComplete posts with forceComplete=true; handleVoid posts to /pos/transactions/:id/void |
| 11 | PaymentModal correctly reads server transaction ID for online payment ReceiptModal | VERIFIED | `PaymentModal.tsx` lines 154–157 — `body.data.id` extracted and passed to `onSuccess(transactionId, { ...receiptData, transactionId })` — envelope parse confirmed correct |

**Score: 11/11 truths verified**

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/db/schema/pos.ts` | 4 POS tables + 3 enums | VERIFIED | shifts, transactions, transactionItems, transactionPayments + shiftStatusEnum, transactionStatusEnum, paymentMethodEnum |
| `apps/api/src/db/schema/accounting.ts` | journalEntries stub | VERIFIED | journalEntries table; JournalEntry + NewJournalEntry types exported |
| `apps/api/src/db/schema/index.ts` | Re-exports pos + accounting | VERIFIED | Lines 8–9: `export * from './pos.js'` and `export * from './accounting.js'` |
| `apps/api/drizzle/0002_pos_accounting_schema.sql` | 5 tables + UNIQUE constraint | VERIFIED | All 5 tables; CONSTRAINT on client_uuid; enums with duplicate_object guard |
| `apps/api/src/modules/pos/pos.service.ts` | completeSale, syncOfflineTx, getTransactionByClientUuid | VERIFIED | All three plus voidTransaction and completeSaleForced |
| `apps/api/src/modules/pos/void.service.ts` | voidTransaction | VERIFIED | Re-exports voidTransaction from pos.service.ts |
| `apps/api/src/modules/accounting/accounting.service.ts` | createJournalEntryStub, createJournalEntryReversal | VERIFIED | Both functions implemented |
| `apps/api/src/modules/shifts/shifts.service.ts` | openShift, closeShift, getActiveShift, getShiftReconciliation | VERIFIED | All four + ShiftReconciliation interface |
| `apps/api/src/modules/shifts/shifts.router.ts` | POST /open, POST /close, GET /:id/reconciliation | VERIFIED | All three routes with authenticate + requireRole |
| `apps/api/src/modules/pos/pos.router.ts` | POST /transactions, POST /transactions/sync, POST /transactions/:id/void | VERIFIED | All three routes; 409 error codes for INSUFFICIENT_STOCK, SHIFT_NOT_OPEN, ALREADY_VOIDED |
| `apps/api/src/index.ts` | posRouter and shiftsRouter mounted | VERIFIED | Lines 45–46: `v1Router.use('/pos', posRouter)` and `v1Router.use('/shifts', shiftsRouter)` |
| `apps/web/src/app/sw.ts` | Serwist service worker | VERIFIED | defaultCache + precacheEntries; serwist.addEventListeners() |
| `apps/web/src/app/manifest.json` | PWA manifest with required fields | VERIFIED | name, short_name, start_url, display: standalone, icons array |
| `apps/web/next.config.ts` | @serwist/next with dev-mode disabled | VERIFIED | `disable: process.env.NODE_ENV === 'development'` |
| `apps/web/src/lib/db/offline-db.ts` | Dexie OfflineDB with offlineQueue + catalog | VERIFIED | offlineQueue PK = clientUuid; catalog PK = variantId; indexes on status, createdAt, barcode, name |
| `apps/web/src/lib/store/cart.store.ts` | Zustand cart store; computeCartTotals | VERIFIED | All actions; immutable state updates; computeCartTotals pure function |
| `apps/web/src/lib/store/shift.store.ts` | Zustand shift store | VERIFIED | useShiftStore with activeShift + setActiveShift |
| `apps/web/src/lib/sync-manager.ts` | syncPendingTransactions, startSyncListener | VERIFIED | Processes pending in createdAt order; updates status to synced/conflict; startSyncListener fires immediately if already online |
| `apps/web/src/lib/catalog.ts` | useCatalogSearch, useCatalogSync, getQuickAddProducts | VERIFIED | useLiveQuery-based search; bulkPut catalog sync; price-desc quick-add |
| `apps/web/src/app/pos/page.tsx` | Full POS page composing all 7 components | VERIFIED | Shift gate; useEffect with startSyncListener; all 7 components composed |
| `apps/web/src/components/pos/ProductPanel.tsx` | Search + barcode + quick-add | VERIFIED | useCatalogSearch wired; barcode auto-add via useEffect; quick-add grid |
| `apps/web/src/components/pos/CartPanel.tsx` | Cart lines with inline editor + BAYAR | VERIFIED | Inline expand; qty + discount type + flat/percent toggle; computeCartTotals; BAYAR calls onPay |
| `apps/web/src/components/pos/PaymentModal.tsx` | Multi-method payment + offline path + correct server ID parsing | VERIFIED | Online/offline paths exist; split payment works; cash change calculated; `body.data.id` parsed correctly (gap closed) |
| `apps/web/src/components/pos/ReceiptModal.tsx` | Print + WhatsApp share | VERIFIED | connectPrinter from onClick; encodeReceipt + printReceipt; buildWhatsAppUrl + window.open |
| `apps/web/src/components/pos/ShiftDrawer.tsx` | Shift open/close with reconciliation | VERIFIED | Two modes; POST /shifts/open and /close; reconciliation display with discrepancy color coding |
| `apps/web/src/components/pos/SyncStatusBar.tsx` | Reactive pending count + isSyncing | VERIFIED | useLiveQuery for pendingCount; amber bar hides when pendingCount === 0 && !isSyncing |
| `apps/web/src/components/pos/SyncIssuesPanel.tsx` | Conflict resolution: Approve / Void | VERIFIED | useLiveQuery on conflict records; handleForceComplete posts with forceComplete=true; handleVoid with local-only fallback |
| `apps/web/src/lib/receipt/encoder.ts` | encodeReceipt 58mm/80mm | VERIFIED | ReceiptPrinterEncoder; 32 cols for 58mm, 48 cols for 80mm |
| `apps/web/src/lib/receipt/whatsapp.ts` | buildWhatsAppUrl | VERIFIED | wa.me URL with all receipt fields URL-encoded |
| `apps/web/src/lib/receipt/webserial.ts` | connectPrinter, printReceipt | VERIFIED | PRINTER_NOT_CONNECTED guard; no auto-connect on mount |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pos.service.ts` | `movement.service.ts` | `recordMovement(params, tx)` | WIRED | Passes outer tx to avoid nested transaction |
| `pos.service.ts` | `accounting.service.ts` | `createJournalEntryStub(..., tx)` | WIRED | Inside same db.transaction() block |
| `pos.service.ts` | `schema/pos.ts` | insert(transactions/transactionItems/transactionPayments) | WIRED | All three tables inserted |
| `void.service.ts` | `pos.service.ts` | `export { voidTransaction }` | WIRED | void.service.ts re-exports voidTransaction from pos.service.ts |
| `shifts.service.ts` | `schema/pos.ts` | shifts, transactions, transactionPayments | WIRED | All three tables imported and queried |
| `index.ts` (api) | `pos/index.ts` | `v1Router.use('/pos', posRouter)` | WIRED | `apps/api/src/index.ts` line 45 |
| `index.ts` (api) | `shifts/index.ts` | `v1Router.use('/shifts', shiftsRouter)` | WIRED | `apps/api/src/index.ts` line 46 |
| `next.config.ts` | `@serwist/next` | `withSerwistInit` | WIRED | Configured with `disable: process.env.NODE_ENV === 'development'` |
| `sync-manager.ts` | `offline-db.ts` | `offlineDB.offlineQueue.where('status').equals('pending').sortBy('createdAt')` | WIRED | sync-manager.ts lines 12–14 |
| `PaymentModal.tsx` | `offline-db.ts` | `offlineDB.offlineQueue.add(...)` | WIRED | PaymentModal.tsx lines 159–164 — offline path writes to queue |
| `PaymentModal.tsx` | `POST /pos/transactions` | `fetch('/api/v1/pos/transactions', ...)` + `body.data.id` | WIRED | Fetch call at line 143; envelope parsed correctly at lines 154–155; `onSuccess(transactionId, ...)` called at line 157 (gap closed) |
| `SyncIssuesPanel.tsx` | `offline-db.ts` | `useLiveQuery on offlineQueue.where('status').equals('conflict')` | WIRED | SyncIssuesPanel.tsx lines 152–156 |
| `SyncIssuesPanel.tsx` | `POST /pos/transactions/:id/void` | `fetch('/api/v1/pos/transactions/${serverId}/void', ...)` | WIRED | SyncIssuesPanel.tsx line 61 |
| `pos/page.tsx` | `sync-manager.ts` | `startSyncListener()` in useEffect | WIRED | page.tsx lines 27–32 |
| `ProductPanel.tsx` | `catalog.ts` | `useCatalogSearch(query)` | WIRED | ProductPanel.tsx line 61 |
| `ProductPanel.tsx` | `cart.store.ts` | `useCartStore().addItem(...)` | WIRED | ProductPanel.tsx lines 72, 79 |
| `CartPanel.tsx` | `cart.store.ts` | `useCartStore(), computeCartTotals()` | WIRED | CartPanel.tsx lines 4, 111–120 |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| POS-01 | 03-01, 03-04, 03-06 | Kasir dapat scan barcode atau cari manual untuk tambah ke cart | SATISFIED | ProductPanel: useCatalogSearch + barcode auto-add via useEffect; quick-add grid |
| POS-02 | 03-01, 03-04, 03-06 | Kasir dapat tambah/kurangi/hapus item + diskon per item | SATISFIED | CartPanel: inline editor with qty, discount type toggle, flat/percent; removeItem |
| POS-03 | 03-04, 03-07 | Multi-payment: tunai, transfer, QRIS | SATISFIED | PaymentModal: up to 3 legs; CASH/TRANSFER/QRIS; split payment validation |
| POS-04 | 03-07 | Receipt cetak dan/atau digital setiap transaksi | SATISFIED | ReceiptModal: encodeReceipt + Web Serial print; buildWhatsAppUrl + window.open; server transaction ID now correctly passed to receipt |
| POS-05 | 03-03, 03-08 | Buka/tutup shift dengan rekap total dan selisih kas | SATISFIED | shifts.service.ts: openShift/closeShift/aggregateReconciliation; ShiftDrawer UI; shift gate in pos/page.tsx |
| POS-06 | 03-04 | Void/cancel transaksi dengan alasan + audit log | SATISFIED | voidTransaction(): RETURN movements, journal reversal, logAudit; pos.router.ts POST /transactions/:id/void |
| POS-07 | 03-05 | PWA + Service Worker — cached assets for offline access | SATISFIED | @serwist/next configured; sw.ts with defaultCache; manifest.json; icon files |
| POS-08 | 03-05, 03-07 | Offline transactions saved to IndexedDB | SATISFIED | offlineDB.offlineQueue via Dexie; PaymentModal writes when !navigator.onLine |
| POS-09 | 03-04, 03-05 | Auto-sync on reconnect with idempotency key (client_uuid) — no duplicates | SATISFIED | startSyncListener on 'online' event; completeSale() checks clientUuid before insert; UNIQUE DB constraint |
| POS-10 | 03-04, 03-08 | Server validates stock on sync; conflicts flagged for cashier resolution | SATISFIED | syncOfflineTx() catches INSUFFICIENT_STOCK and returns conflict; SyncIssuesPanel with Approve/Void |
| POS-11 | 03-02 | Setiap transaksi: inventory_movement(SALE) + journal_entry dalam satu atomic DB transaction | SATISFIED | completeSale(): all steps inside db.transaction() — recordMovement('SALE', tx) + createJournalEntryStub(tx) |

All 11 POS requirements satisfied. The previous partial regression on POS-03 and POS-04 (online receipt transaction ID = undefined) is resolved.

---

## Anti-Patterns Found

No blockers. No TODO/FIXME/placeholder comments found in POS module files. No empty function bodies. No stub return patterns. The previously-flagged anti-pattern in PaymentModal.tsx line 154 has been corrected.

---

## Human Verification Required

### 1. End-to-end cashier flow (in-browser)

**Test:** Run `pnpm dev` and navigate to `http://localhost:3000/pos` with the API server running.

Perform the following checks:
1. Confirm shift gate: page shows "Buka Shift" button before any shift is open
2. Open a shift with an opening float — confirm POS split-screen appears
3. Search a product by name — confirm results from Dexie catalog appear
4. Enter an exact barcode — confirm the item is auto-added and the input clears
5. Tap a cart line — confirm the inline editor expands with qty, discount type toggle, discount value (no modal)
6. Toggle between % and Rp discount types — confirm the line total updates
7. Set a transaction-level discount in the CartPanel totals area — confirm grand total updates
8. Click BAYAR — confirm PaymentModal appears
9. Select Rp100k quick-select button with a Rp75k total — confirm cashTendered updates and change = Rp25k appears
10. Add a second payment leg (split payment) — confirm leg totals must equal cart total before Confirm is enabled
11. Confirm an online payment — confirm ReceiptModal appears and shows the real server transaction ID (not undefined, not the clientUuid)
12. Click "Bagikan via WhatsApp" — confirm a wa.me URL opens in a new browser tab
13. Go offline (Chrome DevTools → Network → Offline); complete a sale — confirm no error; check DevTools → Application → IndexedDB → k21-pos → offlineQueue for a pending record
14. Go back online — confirm SyncStatusBar amber bar appears briefly, then disappears; check that offlineQueue record status changed to 'synced'
15. Close shift: click the shift link in top-right; enter actual cash; confirm reconciliation panel shows opening float, sales by method, expected/actual cash, discrepancy

**Expected:** All 15 checks pass. Step 11 specifically validates the gap-fix: the receipt must show a real UUID from the server, not `undefined` or the client-generated UUID.

**Why human:** Visual layout, barcode device input, real browser offline/online network events, IndexedDB inspection, and receipt content formatting all require manual browser interaction.

---

## Gaps Summary

No programmatic gaps remaining. The sole gap from the initial verification has been closed:

- **PaymentModal API response mismatch (POS-03/04)** — CLOSED. `PaymentModal.tsx` lines 154–155 now parse `body.data.id` from the `{ success, data, error }` envelope correctly. `onSuccess` receives the real server UUID and overwrites `receiptData.transactionId` before passing it to ReceiptModal.

All backend services (completeSale atomicity, idempotency, shifts, void, sync) are correctly implemented and wired. All offline infrastructure (Dexie, Zustand stores, sync manager, service worker, PWA manifest) is in place. Human browser verification is the only remaining step before the phase can be marked fully complete.

---

*Verified: 2026-03-19*
*Verifier: Claude (gsd-verifier)*
