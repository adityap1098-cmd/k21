---
phase: 02-product-inventory
plan: 03
subsystem: api
tags: [drizzle, express, zod, postgresql, products, categories, variants, audit-log]

requires:
  - phase: 02-02
    provides: categories and products schema tables (Drizzle ORM definitions)
  - phase: 01-auth-rbac
    provides: authenticate middleware, requireRole middleware, logAudit function

provides:
  - createCategory / getCategories / updateCategory / deleteCategory service functions
  - GET/POST/PATCH/DELETE /categories routes with role guards
  - createProduct (atomic transaction with default variant) / getProduct / listProducts / updateProduct service functions
  - addVariant / updateVariant service functions
  - GET/POST/PATCH /products and /products/:id/variants routes with role guards
  - categoriesRouter exported from categories/index.ts
  - productsRouter exported from products/index.ts

affects:
  - 02-06 (route mounting — both routers ready to mount)
  - 03-pos (products and variants are the catalog source)
  - 04-procurement (products and variants referenced for POs)

tech-stack:
  added: []
  patterns:
    - vi.hoisted() for DB mock variables to avoid vitest hoisting-before-init errors
    - db.transaction() for atomic multi-table inserts (product + default variant)
    - UUID constants in test fixtures for UUID-validating service functions
    - generateSku(name) inline helper: slug-{8-CHAR-UUID-PREFIX}
    - Service-layer ppnType + categoryId validation before DB operations

key-files:
  created:
    - apps/api/src/modules/categories/categories.service.ts
    - apps/api/src/modules/categories/categories.router.ts
    - apps/api/src/modules/categories/index.ts
    - apps/api/src/modules/products/products.service.ts
    - apps/api/src/modules/products/products.router.ts
    - apps/api/src/modules/products/index.ts
  modified:
    - apps/api/src/modules/categories/categories.test.ts
    - apps/api/src/modules/products/products.test.ts

key-decisions:
  - "vi.hoisted() required for DB mock variables — vitest hoists vi.mock() calls before const declarations; vi.hoisted() runs in the same hoisting pass"
  - "UUID-format test fixtures required when service validates categoryId format — test data must pass all validations to reach mocked DB layer"
  - "ppnType and categoryId validated at service layer (not just Zod router layer) — services can be called programmatically without router validation"
  - "generateSku is inline helper (no library) — name slug + first 8 chars of UUID uppercased, matches plan spec exactly"
  - "db.transaction() wraps both product insert and default variant insert — atomic guarantee per plan requirement"

requirements-completed: [PROD-01, PROD-02, PROD-03]

duration: 6min
completed: 2026-03-18
---

# Phase 02 Plan 03: Categories and Products Modules Summary

**Drizzle-backed categories (CRUD + grandchild guard) and products (atomic transaction with auto-SKU default variant, JSONB variant attributes, ppnType) modules with Express routers and Zod validation — all PROD-01/02/03 tests GREEN**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-17T21:49:09Z
- **Completed:** 2026-03-17T21:55:12Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Categories module: createCategory (max-one-level hierarchy enforcement), getCategories, updateCategory, deleteCategory (blocked if products assigned), all with logAudit calls
- Products module: createProduct uses db.transaction to insert product + default variant atomically; addVariant with DUPLICATE_SKU check; updateProduct/updateVariant with audit logs; ppnType field exposed on getProduct
- All 15 new tests pass GREEN (7 categories + 8 products); full suite 59 tests, no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Categories module (service + router + index)** - `0234ff1` (feat)
2. **Task 2: Products module (service + router + index)** - `2076d61` (feat)

## Files Created/Modified

- `apps/api/src/modules/categories/categories.service.ts` - createCategory, getCategories, updateCategory, deleteCategory
- `apps/api/src/modules/categories/categories.router.ts` - GET/POST/PATCH/DELETE /categories with authenticate + requireRole guards
- `apps/api/src/modules/categories/index.ts` - barrel export of categoriesRouter
- `apps/api/src/modules/categories/categories.test.ts` - 7 tests covering all service behaviors
- `apps/api/src/modules/products/products.service.ts` - createProduct (atomic transaction), getProduct, listProducts, updateProduct, addVariant, updateVariant
- `apps/api/src/modules/products/products.router.ts` - GET/POST/PATCH /products + variant sub-routes with role guards
- `apps/api/src/modules/products/index.ts` - barrel export of productsRouter
- `apps/api/src/modules/products/products.test.ts` - 8 tests covering PROD-01, PROD-02, PROD-03

## Decisions Made

- `vi.hoisted()` used for DB mock variable declarations — vitest hoists `vi.mock()` factories before `const` declarations, causing "Cannot access before initialization" errors. `vi.hoisted()` runs in the same early pass, making variables available to the factory.
- UUID constants used in test fixtures because the products service validates `categoryId` format. Short strings like `'cat-uuid-1'` would fail the UUID regex check before reaching the mocked DB layer.
- `ppnType` validated at service layer (not only Zod router layer) — services are called programmatically in tests without going through the router, so validation must exist at service boundaries.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test fixture IDs changed from short strings to valid UUIDs**
- **Found during:** Task 2 (products service implementation)
- **Issue:** Service validates `categoryId` is UUID format; test fixtures used `'cat-uuid-1'` (not a valid UUID), causing all happy-path tests to throw `INVALID_CATEGORY_ID` before reaching DB mocks
- **Fix:** Replaced all short-string IDs in products.test.ts with proper UUID-format constants (`'11111111-1111-...'` pattern)
- **Files modified:** `apps/api/src/modules/products/products.test.ts`
- **Verification:** All 8 products tests pass GREEN
- **Committed in:** `2076d61` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - test fixture correctness)
**Impact on plan:** Required for tests to reach the mocked DB layer. No scope creep.

## Issues Encountered

- vitest hoisting: initial test mock pattern using `const mockDbSelect = vi.fn()` before `vi.mock()` caused "Cannot access before initialization" runtime errors. Fixed by switching to `vi.hoisted()` pattern (consistent with how the users.test.ts and auth.test.ts were already structured in practice).

## Next Phase Readiness

- `categoriesRouter` and `productsRouter` both exported from their respective `index.ts` barrel files, ready for mounting in plan 02-06
- All PROD-01, PROD-02, PROD-03 requirements fulfilled
- Variant SKU auto-generation, JSONB attributes, and ppnType classification all operational

---
*Phase: 02-product-inventory*
*Completed: 2026-03-18*

## Self-Check: PASSED

All 7 created files verified on disk. Both task commits (0234ff1, 2076d61) verified in git log.
