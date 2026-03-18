---
phase: 03-pos-with-offline-mode
plan: 07
subsystem: ui
tags: [escpos, webserial, whatsapp, receipt, payment, split-payment, pwa, offline]

# Dependency graph
requires:
  - phase: 03-05
    provides: cart.store.ts, shift.store.ts, offline-db.ts with CompleteSaleParams and offlineDB.offlineQueue

provides:
  - encodeReceipt(data, width) — ESC/POS Uint8Array for 58mm (32 cols) and 80mm (48 cols)
  - buildWhatsAppUrl(data) — wa.me URL with full receipt fields encoded
  - connectPrinter() / printReceipt() — Web Serial printer abstraction
  - PaymentModal — multi-method (CASH/TRANSFER/QRIS), split payment up to 3 legs, cash change, offline queue write
  - ReceiptModal — thermal print + WhatsApp share + new transaction flow

affects:
  - pos/page.tsx (mounts PaymentModal and ReceiptModal after cart confirmation)

# Tech tracking
tech-stack:
  added:
    - "@point-of-sale/receipt-printer-encoder@3.0.3 — ESC/POS byte generation"
    - "@point-of-sale/webserial-receipt-printer@2.0.0 — Web Serial API wrapper"
  patterns:
    - "Ambient type declarations (.d.ts) for packages without bundled types"
    - "User-gesture gate for Web Serial connect — connectPrinter() called only from onClick"
    - "Online/offline fork in confirm handler — fetch vs offlineDB.offlineQueue.add"

key-files:
  created:
    - apps/web/src/lib/receipt/encoder.ts
    - apps/web/src/lib/receipt/webserial.ts
    - apps/web/src/lib/receipt/whatsapp.ts
    - apps/web/src/components/pos/PaymentModal.tsx
    - apps/web/src/components/pos/ReceiptModal.tsx
    - apps/web/src/types/point-of-sale.d.ts
  modified: []

key-decisions:
  - "Ambient .d.ts created for @point-of-sale packages — neither receipt-printer-encoder nor webserial-receipt-printer ship TypeScript declarations; EncoderInstance interface added to model the fluent builder chain"
  - "cashTendered separate from leg.amount — cashTendered tracks physical cash received; leg.amount is capped at cashOwed so split legs remain correct"
  - "connectPrinter() called exclusively in handlePrint onClick — Web Serial API requires transient user activation; never called on mount or in useEffect"
  - "window.print() fallback in ReceiptModal — if Web Serial throws (device not found, permission denied), falls back to browser print dialog silently"

patterns-established:
  - "Online/offline fork: navigator.onLine check before fetch; offline path writes to offlineDB.offlineQueue with clientUuid and status=pending"
  - "Receipt data assembled in PaymentModal at confirm time and passed to onSuccess; ReceiptModal is purely display"

requirements-completed: [POS-03, POS-04]

# Metrics
duration: 15min
completed: 2026-03-18
---

# Phase 3 Plan 07: Payment Flow and Receipt Generation Summary

**ESC/POS receipt encoding (58mm/80mm), Web Serial thermal printing, WhatsApp receipt sharing, and multi-method split payment modal with cash change and offline queue fallback**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-18T08:36:57Z
- **Completed:** 2026-03-18T08:51:00Z
- **Tasks:** 2
- **Files modified:** 6 created + 1 (types)

## Accomplishments

- Three receipt helper libraries: ESC/POS encoder, Web Serial printer adapter, WhatsApp URL builder
- PaymentModal with CASH/TRANSFER/QRIS method tabs, split payment (up to 3 legs), Rp50k/100k/200k quick-select, change-due display, sum validation, and online/offline confirm path
- ReceiptModal with thermal print (Web Serial + browser fallback) and WhatsApp share

## Task Commits

1. **Task 1: Receipt helpers — encoder, webserial, whatsapp** - `805be6d` (feat)
2. **Task 2: PaymentModal + ReceiptModal components** - `5223f6e` (feat)

## Files Created/Modified

- `apps/web/src/lib/receipt/encoder.ts` - encodeReceipt() ESC/POS builder for 58mm (32 cols) and 80mm (48 cols) paper widths
- `apps/web/src/lib/receipt/webserial.ts` - connectPrinter() / printReceipt() / isPrinterConnected() wrapping @point-of-sale/webserial-receipt-printer
- `apps/web/src/lib/receipt/whatsapp.ts` - buildWhatsAppUrl() returns wa.me URL with all receipt fields
- `apps/web/src/components/pos/PaymentModal.tsx` - full payment modal: split legs, cash change, offline queue write
- `apps/web/src/components/pos/ReceiptModal.tsx` - post-sale receipt display with thermal print and WhatsApp share
- `apps/web/src/types/point-of-sale.d.ts` - ambient declarations for @point-of-sale/receipt-printer-encoder and @point-of-sale/webserial-receipt-printer

## Decisions Made

- Ambient type declarations created for @point-of-sale packages — neither package ships .d.ts; fluent builder interface modeled in EncoderInstance
- `cashTendered` tracked separately from `leg.amount` — physical cash received vs capped payment amount for correct change calculation in split payment scenarios
- `connectPrinter()` called only inside `handlePrint` onClick — Web Serial requires transient user activation, never in useEffect/mount
- `window.print()` as silent fallback — ReceiptModal catches Web Serial errors and falls back to browser print dialog

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added ambient type declarations for @point-of-sale packages**
- **Found during:** Task 1 (Receipt helpers)
- **Issue:** `@point-of-sale/receipt-printer-encoder` and `@point-of-sale/webserial-receipt-printer` do not include TypeScript declaration files; tsc reported TS7016 / TS2307 errors
- **Fix:** Created `apps/web/src/types/point-of-sale.d.ts` with `declare module` blocks covering the APIs used
- **Files modified:** apps/web/src/types/point-of-sale.d.ts
- **Verification:** `pnpm --filter @k21/web exec tsc --noEmit` exits 0 with no new errors
- **Committed in:** `805be6d` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 — missing type safety)
**Impact on plan:** Required for TypeScript compilation. No scope creep.

## Issues Encountered

None beyond the auto-fixed type declarations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PaymentModal and ReceiptModal are complete UI components ready to be mounted in `apps/web/src/app/pos/page.tsx`
- encodeReceipt, buildWhatsAppUrl, connectPrinter, printReceipt are all exported and ready for direct use
- No blockers for next plan

## Self-Check: PASSED

- All 6 files created and verified on disk
- Task commits verified: 805be6d, 5223f6e
- `pnpm --filter @k21/web exec tsc --noEmit` exits 0

---
*Phase: 03-pos-with-offline-mode*
*Completed: 2026-03-18*
