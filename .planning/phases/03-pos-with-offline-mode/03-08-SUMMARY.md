---
phase: 03-pos-with-offline-mode
plan: "08"
subsystem: ui
tags: [react, nextjs, dexie, indexeddb, pwa, offline-sync, pos]

# Dependency graph
requires:
  - phase: 03-pos-with-offline-mode/03-05
    provides: sync-manager.ts, shift.store.ts, offline-db.ts, sync infrastructure
  - phase: 03-pos-with-offline-mode/03-06
    provides: ProductPanel, CartPanel, POS page route
  - phase: 03-pos-with-offline-mode/03-07
    provides: PaymentModal, ReceiptModal, receipt encoder
provides:
  - ShiftDrawer component — shift open/close UI with float capture and reconciliation display
  - SyncStatusBar component — reactive pending-count indicator using Dexie useLiveQuery
  - SyncIssuesPanel component — conflict resolution UI with Approve (force) and Void actions
  - Complete POS page.tsx composing all 7 components with shift gate
  - forceComplete sync path in pos.service.ts bypassing stock validation with audit trail
  - startSyncListener registered in POS page useEffect for auto-sync on reconnect
affects:
  - phase-04-accounting
  - phase-07-finance
  - any phase consuming POS transaction data

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Shift gate pattern — POS page renders locked state (Buka Shift CTA) when activeShift === null
    - useLiveQuery for reactive IndexedDB reads — SyncStatusBar and SyncIssuesPanel re-render automatically on Dexie table changes
    - Force-complete audit trail — FORCE_COMPLETE suffix in inventory movement reference + audit_logs entry when stock goes negative intentionally

key-files:
  created:
    - apps/web/src/components/pos/ShiftDrawer.tsx
    - apps/web/src/components/pos/SyncStatusBar.tsx
    - apps/web/src/components/pos/SyncIssuesPanel.tsx
  modified:
    - apps/web/src/app/pos/page.tsx
    - apps/web/src/components/pos/CartPanel.tsx
    - apps/api/src/modules/pos/pos.service.ts

key-decisions:
  - "SyncStatusBar uses useLiveQuery internally for pendingCount — parent passes only isSyncing boolean; avoids prop-drilling reactive state"
  - "forceComplete flag in syncOfflineTx skips stock FOR UPDATE check — stock may go negative; audit trail via [FORCE_COMPLETE] reference suffix"
  - "Local-only void for conflicts with no serverId — IndexedDB record deleted locally, no server call since no server record was created"

patterns-established:
  - "Shift gate pattern: check activeShift in page root, render locked screen with ShiftDrawer trigger if null"
  - "useLiveQuery for all reactive IndexedDB reads — no manual subscription management needed"
  - "Force-complete audit trail: append [FORCE_COMPLETE] to inventory movement reference for stock-negative operations"

requirements-completed: [POS-05, POS-06, POS-07, POS-08, POS-09, POS-10]

# Metrics
duration: multi-session
completed: 2026-03-19
---

# Phase 03 Plan 08: POS UI Final Wiring Summary

**Complete POS screen with shift gate, offline sync bar, conflict resolution panel, and all 7 components composed — human-verified across 15 checks including offline IndexedDB flow and shift reconciliation**

## Performance

- **Duration:** multi-session (continuation after checkpoint)
- **Started:** 2026-03-18
- **Completed:** 2026-03-19
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 6

## Accomplishments

- ShiftDrawer handles both shift-open (with opening float) and shift-close (with reconciliation: opening float, sales by method, expected vs actual cash, discrepancy highlighted) flows
- SyncStatusBar uses Dexie useLiveQuery to reactively show pending offline transaction count; disappears when queue is empty
- SyncIssuesPanel lists IndexedDB conflict records with Approve (force-complete re-sync) and Void (local-only or server void) actions per row
- POS page gates behind shift check — cashier cannot access screen without an active shift; startSyncListener registered in useEffect for auto-sync on network reconnect
- forceComplete path added to pos.service.ts syncOfflineTx() — skips stock validation, records audit with [FORCE_COMPLETE] reference for inventory movements that push stock negative

## Task Commits

Each task was committed atomically:

1. **Task 1: ShiftDrawer + SyncStatusBar + SyncIssuesPanel** - `b4b7c96` (feat)
2. **Task 2: Wire complete POS page** - `af96510` (feat)
3. **Task 3: Human verification checkpoint** - approved (no code commit — verification only)

## Files Created/Modified

- `apps/web/src/components/pos/ShiftDrawer.tsx` - Shift open/close drawer with reconciliation display after close
- `apps/web/src/components/pos/SyncStatusBar.tsx` - Amber sticky bar showing pending offline transaction count via Dexie useLiveQuery
- `apps/web/src/components/pos/SyncIssuesPanel.tsx` - Fixed right panel listing IndexedDB conflict records with Approve and Void actions
- `apps/web/src/app/pos/page.tsx` - Full POS page composing all 7 components; shift gate; sync listener useEffect
- `apps/web/src/components/pos/CartPanel.tsx` - Added onPay prop to wire BAYAR button to PaymentModal
- `apps/api/src/modules/pos/pos.service.ts` - Added forceComplete parameter to syncOfflineTx(); skips stock check; logs audit trail

## Decisions Made

- SyncStatusBar receives only `isSyncing` from parent; computes `pendingCount` itself via `useLiveQuery(() => offlineDB.offlineQueue.where('status').equals('pending').count())` — eliminates prop-drilling and keeps reactive read co-located with the component
- forceComplete flag skips the `SELECT ... FOR UPDATE` stock validation in `syncOfflineTx()` — stock can go negative intentionally; the trade-off is captured in the inventory movement reference as `[FORCE_COMPLETE]` and in audit_logs for full traceability
- Local-only void: if no `serverId` exists on a conflict row, Void simply deletes the IndexedDB record (no server call) — no server transaction was created so there is nothing to void server-side

## Deviations from Plan

None — plan executed exactly as written. The forceComplete server-side update in pos.service.ts was explicitly called out in the plan spec as a required part of Task 1.

## Issues Encountered

None — TypeScript compilation passed after each task; all 15 human verification checks approved without modifications required.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Complete POS offline-online flow is production-ready: shift gate, offline queue, auto-sync, conflict resolution, receipt generation all verified end-to-end
- Phase 3 (POS with offline mode) is now fully complete across all 8 plans
- Phase 4 (Accounting stub) can begin — POS transaction data model is stable and all required endpoints are tested

---
*Phase: 03-pos-with-offline-mode*
*Completed: 2026-03-19*
