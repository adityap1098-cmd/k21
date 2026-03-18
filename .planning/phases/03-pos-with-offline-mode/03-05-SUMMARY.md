---
phase: 03-pos-with-offline-mode
plan: 05
subsystem: ui
tags: [pwa, serwist, dexie, indexeddb, zustand, service-worker, offline, sync]

# Dependency graph
requires:
  - phase: 03-pos-with-offline-mode
    provides: POS API routes (completeSale, syncOfflineTx, shifts) from plans 03-01 through 03-04

provides:
  - PWA service worker via @serwist/next (sw.ts with precache + defaultCache runtime caching)
  - Web app manifest (manifest.json) with standalone display for installable PWA
  - Dexie offline IndexedDB (offlineQueue + catalog tables)
  - Zustand cart store (immutable updates, computeCartTotals pure function)
  - Zustand shift store (activeShift tracking)
  - syncPendingTransactions() processes pending offline queue in createdAt order
  - startSyncListener() auto-syncs on 'online' event

affects:
  - 03-06 (POS UI — depends on useCartStore, useShiftStore, offlineDB)
  - 03-07 (POS receipt/shift UI — depends on useShiftStore, syncPendingTransactions)

# Tech tracking
tech-stack:
  added:
    - "@serwist/next@9.5.7 — PWA service worker for Next.js App Router"
    - "serwist — service worker runtime with precache + runtime caching"
    - "dexie — IndexedDB wrapper for offline transaction queue and catalog cache"
    - "dexie-react-hooks — React hooks for reactive Dexie queries"
    - "zustand — lightweight state management for cart and shift stores"
    - "@point-of-sale/receipt-printer-encoder — receipt encoding (used in plan 06/07)"
    - "@point-of-sale/webserial-receipt-printer — WebSerial receipt printer driver"
  patterns:
    - "Serwist service worker: self.__SW_MANIFEST precache + defaultCache runtime caching"
    - "Dexie schema: first field = primary key, subsequent fields = indexes"
    - "Zustand immutable updates: all set() callbacks return new objects, never mutate state"
    - "Offline-first sync: write to IndexedDB first, flush on 'online' event"

key-files:
  created:
    - "apps/web/src/app/sw.ts"
    - "apps/web/src/app/manifest.json"
    - "apps/web/src/lib/db/offline-db.ts"
    - "apps/web/src/lib/store/cart.store.ts"
    - "apps/web/src/lib/store/shift.store.ts"
    - "apps/web/src/lib/sync-manager.ts"
    - "apps/web/public/icons/icon-192.png"
    - "apps/web/public/icons/icon-512.png"
  modified:
    - "apps/web/next.config.ts"
    - "apps/web/package.json"
    - "apps/web/tsconfig.json"
    - "pnpm-lock.yaml"

key-decisions:
  - "sw.ts uses WorkerGlobalScope cast (not ServiceWorkerGlobalScope) to avoid webworker lib in tsconfig — Serwist typings do not expose ServiceWorkerGlobalScope via ./typings path; WorkerGlobalScope + unknown cast achieves same runtime behavior"
  - "CompleteSaleParams inlined in offline-db.ts — not yet exported from @k21/shared; avoids cross-package import from apps/api"
  - "@serwist/next configured with disable: process.env.NODE_ENV === 'development' — prevents SW interference during local Next.js dev server"
  - "OfflineDB exported as class (not just singleton) to support testing with fresh instances"

patterns-established:
  - "Offline queue pattern: clientUuid PK for idempotent sync; status transitions pending→synced|conflict"
  - "Sync break-on-network-error: loop breaks on catch to preserve ordering; retry happens on next 'online' event"
  - "Zustand store files in apps/web/src/lib/store/ — one file per domain store"

requirements-completed: [POS-07, POS-08, POS-09, POS-10]

# Metrics
duration: 6min
completed: 2026-03-18
---

# Phase 3 Plan 05: PWA Infrastructure Summary

**@serwist/next service worker, Dexie offline queue (IndexedDB), and Zustand cart/shift stores enabling offline-first POS with automatic sync on reconnect**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-18T08:28:00Z
- **Completed:** 2026-03-18T08:33:44Z
- **Tasks:** 2
- **Files modified:** 11 (4 modified + 8 created - 1 pnpm-lock)

## Accomplishments

- Installed and wired @serwist/next with development-mode disable flag; sw.ts registered with precache + defaultCache runtime caching
- Dexie OfflineDB with offlineQueue (PK: clientUuid, indexes: status, createdAt) and catalog (PK: variantId, indexes: barcode, name)
- Zustand cart store with all required actions (addItem, updateQty, setItemDiscount, setTransactionDiscount, removeItem, clearCart) using immutable update pattern; computeCartTotals pure function
- syncPendingTransactions() processes pending records sorted by createdAt, updates to synced/conflict; startSyncListener() wires 'online' event and fires immediately if already online

## Task Commits

Each task was committed atomically:

1. **Task 1: Install PWA dependencies + configure @serwist/next** - `923ab8d` (feat)
2. **Task 2: Dexie offline DB + Zustand stores + sync manager** - `701cc0b` (feat)

**Plan metadata:** `a5a5204` (docs: complete plan)

## Files Created/Modified

- `apps/web/next.config.ts` - Wrapped with withSerwistInit; disable in development
- `apps/web/package.json` - Added @serwist/next, serwist, dexie, dexie-react-hooks, zustand, receipt printer packages
- `apps/web/tsconfig.json` - Added @serwist/next/typings type, excluded public/sw.js
- `apps/web/src/app/sw.ts` - Serwist service worker: precacheEntries from __SW_MANIFEST, defaultCache runtime caching
- `apps/web/src/app/manifest.json` - PWA manifest: name="K21 POS", display=standalone, start_url=/pos
- `apps/web/src/lib/db/offline-db.ts` - Dexie OfflineDB class + offlineDB singleton; OfflineTransaction + CatalogProduct interfaces; CompleteSaleParams inlined
- `apps/web/src/lib/store/cart.store.ts` - useCartStore Zustand store + computeCartTotals pure function
- `apps/web/src/lib/store/shift.store.ts` - useShiftStore for active shift tracking
- `apps/web/src/lib/sync-manager.ts` - syncPendingTransactions() + startSyncListener()
- `apps/web/public/icons/icon-192.png` - Placeholder PWA icon
- `apps/web/public/icons/icon-512.png` - Placeholder PWA icon

## Decisions Made

- **ServiceWorkerGlobalScope cast:** sw.ts uses `self as unknown as WorkerGlobalScope & {...}` instead of `declare const self: ServiceWorkerGlobalScope` — the `webworker` lib is excluded from tsconfig per plan, and `@serwist/next/typings` maps to `sw-entry.d.ts` which doesn't provide ServiceWorkerGlobalScope. WorkerGlobalScope + cast achieves correct runtime behavior.
- **CompleteSaleParams inlined:** Not in @k21/shared yet; inlined in offline-db.ts to avoid importing from apps/api (cross-app imports break module boundaries).
- **OfflineDB class exported:** Both `export class OfflineDB` and `export const offlineDB` exported — allows tests to instantiate fresh OfflineDB with in-memory Dexie.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] sw.ts: ServiceWorkerGlobalScope unavailable without webworker lib**
- **Found during:** Task 1 (tsc --noEmit verification)
- **Issue:** `declare const self: ServiceWorkerGlobalScope` causes TS2552 because ServiceWorkerGlobalScope is only in the webworker lib, which the plan explicitly says NOT to add
- **Fix:** Changed to `const sw = self as unknown as WorkerGlobalScope & { __SW_MANIFEST: ... }` — functionally equivalent, type-checks without webworker lib
- **Files modified:** apps/web/src/app/sw.ts
- **Verification:** tsc --noEmit passes with no errors
- **Committed in:** 923ab8d (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — TypeScript type cast workaround)
**Impact on plan:** Required for tsc --noEmit to pass. No behavior change at runtime — service worker operates identically.

## Issues Encountered

None beyond the documented deviation above.

## User Setup Required

None — no external service configuration required for offline infrastructure layer.

## Next Phase Readiness

- Cart store, shift store, offline DB, and sync manager are all available for import by Phase 3 plans 06/07 (POS UI)
- @serwist/next configured and ready — service worker will be compiled by Next.js build pipeline
- Receipt printer packages installed and available for plan 06/07

---
*Phase: 03-pos-with-offline-mode*
*Completed: 2026-03-18*
