---
phase: 03-pos-with-offline-mode
plan: "06"
subsystem: web/pos-ui
tags: [pos, ui, react, dexie, zustand, tailwind]
dependency_graph:
  requires: [03-05]
  provides: [pos-split-screen-ui, catalog-search-hooks]
  affects: [03-07, 03-08]
tech_stack:
  added: []
  patterns: [useLiveQuery, zustand-selector, inline-editor-pattern]
key_files:
  created:
    - apps/web/src/lib/catalog.ts
    - apps/web/src/app/pos/page.tsx
    - apps/web/src/components/pos/ProductPanel.tsx
    - apps/web/src/components/pos/CartPanel.tsx
  modified:
    - apps/web/tsconfig.json
decisions:
  - "useCartStore() destructure (not selector callbacks) avoids implicit-any in strict mode when CartState is not exported"
  - "tsconfig paths @/* added for tsc --noEmit resolution — Next.js configures this at runtime but tsc standalone needs it"
  - "getQuickAddProducts sorts by price desc as proxy for popular items — no usage tracking in Phase 3"
  - "Barcode auto-add via useEffect watching searchResults — fires when 1 result with exact barcode match"
metrics:
  duration: "5m"
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_created: 4
  files_modified: 1
---

# Phase 3 Plan 6: POS Split-Screen UI Summary

**One-liner:** Dexie-backed catalog search hooks and Tailwind split-screen POS UI with barcode auto-add, inline cart editing, and Rupiah totals.

## What Was Built

### Task 1: Catalog hooks + POS page route (commit 079a206)

**`apps/web/src/lib/catalog.ts`** — three exports:
- `useCatalogSearch(query)` — `useLiveQuery` against `offlineDB.catalog`, filters by name/SKU/barcode, limit 20
- `useCatalogSync()` — fetches `/api/v1/products?variants=true&active=true`, `bulkPut` into Dexie, tracks `isSyncing`/`lastSyncedAt`
- `getQuickAddProducts()` — async, returns top 20 by price desc

**`apps/web/src/app/pos/page.tsx`** — Server Component shell with flex h-screen layout: `flex-1` ProductPanel left, `w-96` CartPanel right.

### Task 2: ProductPanel + CartPanel (commit d417806)

**`apps/web/src/components/pos/ProductPanel.tsx`**:
- Large search/scan input (autofocus) feeding `useCatalogSearch`
- `useEffect` barcode detection: single result with `barcode === query` auto-adds and clears input
- When query empty: 3-column quick-add grid loaded from `getQuickAddProducts()` on mount
- When query non-empty: search results list with name/SKU/price and "+" add button

**`apps/web/src/components/pos/CartPanel.tsx`**:
- Cart lines with click-to-expand inline editor per line (no modal): qty input, %/Rp discount toggle + value input, Hapus remove button
- Totals area: subtotal (before item discounts), item discounts row (visible when >0), Rp transaction discount input, bold TOTAL
- BAYAR button: disabled when cart empty, blue full-width, `onClick={}` placeholder for plan 03-07
- All amounts via `computeCartTotals()` from `cart.store.ts` — not reimplemented

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Config] Added `@/*` path alias to tsconfig.json**
- **Found during:** Task 1 verification (tsc --noEmit)
- **Issue:** `@/` imports resolved at Next.js build time but tsc standalone had no `paths` mapping, causing TS2307 for all `@/components/...` and `@/lib/...` imports
- **Fix:** Added `"paths": { "@/*": ["./src/*"] }` to `apps/web/tsconfig.json`
- **Files modified:** `apps/web/tsconfig.json`
- **Commit:** 079a206

**2. [Rule 1 - Bug] Used destructured `useCartStore()` instead of selector callbacks**
- **Found during:** Task 2 verification (tsc --noEmit)
- **Issue:** Selector callbacks `s => s.items` were typed as `(s: any) => any` because `CartState` is not exported from cart.store.ts; strict mode rejected implicit `any`
- **Fix:** Changed to `const { items, updateQty, ... } = useCartStore()` which infers types from the `create<CartState>` return type without needing `CartState` exported
- **Files modified:** `apps/web/src/components/pos/CartPanel.tsx`, `apps/web/src/components/pos/ProductPanel.tsx`
- **Commit:** d417806

## Verification

- `pnpm --filter @k21/web exec tsc --noEmit` — PASSED (0 errors in new files)
- ProductPanel renders search bar + quick-add grid — confirmed by component structure
- CartPanel renders inline editor expansion on row tap — confirmed by `expandedVariantId` state
- `computeCartTotals` used for all totals — confirmed, no inline reimplementation
- All files under 400 lines — ProductPanel: 133 lines, CartPanel: 197 lines, catalog.ts: 48 lines

## Self-Check: PASSED

All 4 created files found on disk. Both commits (079a206, d417806) confirmed in git log.
