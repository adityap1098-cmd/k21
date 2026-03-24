# Audit: Warehouse Module Implementation (Backend ↔ Frontend)
**Project:** K21 (Monorepo)
**Date:** 2026-03-22
**Methodology:** Deep Research Skill (Layer 1–3 analysis)

---

## Executive Summary

| Metric | Result |
|--------|--------|
| **Overall Status** | ⚠️ **Partial** |
| **Backend Coverage** | ✅ **Full (3/3 endpoints)** |
| **Frontend Coverage** | 🔴 **Partial (1/3 endpoints)** |
| **Frontend-Backend Sync** | ✅ **Matched payload schema** |
| **Integration Status** | ⚠️ **Functional but incomplete features** |
| **Critical Gaps** | Warehouse stock detail view, stock transfer UI |

---

## Layer 1: Implementation Detail (Actual Code)

### Backend Implementation

#### **Endpoint 1: GET `/api/v1/warehouse/warehouses`** ✅

**Location:** `/apps/api/src/modules/warehouse/warehouse.router.ts:26–39`

- **Implementation Type:** Real (non-stub)
- **Service Called:** `listWarehouses()`
- **Return Value:** Hardcoded array of 3 warehouses from config
  ```typescript
  const WAREHOUSES: Warehouse[] = [
    { id: 'warehouse-gudang-a', name: 'Gudang A', address: 'Jl. Gudang, Jakarta', isActive: true },
    { id: 'warehouse-gudang-b', name: 'Gudang B', address: 'Jl. Gudang Alt, Jakarta', isActive: true },
    { id: 'warehouse-display-toko', name: 'Display Toko', address: 'Jl. Toko Utama, Jakarta', isActive: true }
  ]
  ```
- **Database Query:** None — returns static configuration
- **Auth:** Requires `authenticate` + `requireRole('Owner', 'Admin', 'Warehouse Staff')`
- **Response Format:** `{ success: true, data: Warehouse[], error: null }`
- **Status:** ✅ **Fully Implemented**

---

#### **Endpoint 2: GET `/api/v1/warehouse/warehouses/:id/stock`** 🟡

**Location:** `/apps/api/src/modules/warehouse/warehouse.router.ts:48–67`

- **Implementation Type:** Stub/Placeholder
- **Service Called:** `getWarehouseStock(warehouseId)`
- **Critical Issue:** Query is incomplete — warehouse attribution logic missing

**Code Analysis:**
```typescript
// Line 93-97 in warehouse.service.ts
.where(
  and(
    // Match movements with reference starting with warehouse ID (e.g., "warehouse-gudang-a:...")
    // If no reference, we can't attribute to a warehouse, so we exclude
  )
)
```

The `and()` condition is **empty** — no actual WHERE clause filtering by warehouse ID. This means:
1. The query returns an empty `movements` array
2. No variants are selected (line 101 `variantIds.length === 0` → returns `[]`)
3. The endpoint always returns empty stock for every warehouse

**Expected Return:** Array of `WarehouseStock[]` (variant + qty per warehouse)
**Actual Return:** Always `[]` (empty)

**Database Fields Issue:** Schema lacks warehouse location tracking:
- `inventory_movements` has a `reference` field (varchar 255) but NO dedicated location/warehouse field
- `product_variants` has `stockQty` but NO warehouse location

**Auth:** Requires `authenticate` + `requireRole('Owner', 'Admin', 'Warehouse Staff')`
**Error Handling:** 404 if warehouse ID not found in static config
**Status:** 🟡 **Stub — Interface exists, returns empty data**

---

#### **Endpoint 3: POST `/api/v1/warehouse/transfers`** ✅

**Location:** `/apps/api/src/modules/warehouse/warehouse.router.ts:78–120`

- **Implementation Type:** Real (non-stub)
- **Service Called:** `transferStock()`
- **Zod Schema Validation:**
  ```typescript
  {
    variantId: z.string().uuid(),
    fromWarehouse: z.string().min(1),
    toWarehouse: z.string().min(1),
    qty: z.number().int().positive(),
    reference: z.string().optional()
  }
  ```
- **Database Interaction:**
  1. Verifies both warehouses exist in static config
  2. Validates variant exists + has sufficient stock
  3. Records movement with type `TRANSFER` via `recordMovement()`
  4. Updates `product_variants.stock_qty` with SQL: `stock_qty = stock_qty - qty`

**Transactional:** Yes (wrapped in `db.transaction()`)
**Side Effects:**
- Creates row in `inventory_movements` with `movementType='TRANSFER'`, `qty` (negative per convention)
- Decrements `product_variants.stock_qty` by exact qty

**Error Codes:**
- 400: Invalid payload or qty ≤ 0
- 404: Warehouse or variant not found
- 409: Insufficient stock
- 500: Database error

**Status:** ✅ **Fully Implemented**

---

### Frontend Implementation

#### **Page: `/warehouse` (/apps/web/src/app/warehouse/page.tsx)** ⚠️

**Component Type:** `'use client'` React page
**Structure:**
1. **Warehouses Tab** (active default)
   - Calls: `apiGet<Warehouse[]>('/api/v1/warehouse/warehouses')`
   - Displays: Cards with warehouse name, address, active status, location type badges
   - Search: Text filter by warehouse name
   - Actions: "Picking List" button (no handler), "Tambah Gudang" button (no handler)

2. **Picking & Packing Tab** (placeholder)
   - Static UI with empty state message
   - No API calls, no functionality

**Data Flow:**
```
useEffect → loadData() → apiGet('/api/v1/warehouse/warehouses')
  → res.success? setWarehouses(res.data) → render cards
```

**API Call Verification:**
- **Endpoint Called:** `/api/v1/warehouse/warehouses` ✅
- **Response Type Expected:** `Warehouse[]` (id, name, address, isActive) ✅
- **Payload Handling:** Correct — uses `apiGet<Warehouse[]>()` ✅
- **Type Safety:** Warehouse interface defined (line 18-20) ✅

**Issue 1: Warehouse Stock Details Missing** 🔴
- No link/button to view stock for a specific warehouse
- `getWarehouseStock()` endpoint exists but never called from frontend
- Card shows only metadata, not inventory

**Issue 2: Stock Transfer UI Missing** 🔴
- No form to create transfers
- `/api/v1/warehouse/transfers` endpoint exists but never called
- "Picking List" button has no click handler
- "Tambah Gudang" button has no click handler

**Issue 3: Picking & Packing Stub** 🟡
- Tab exists but contains only static empty state
- No functionality, no API calls
- Acts as placeholder for future feature

**Status:** 🔴 **Partial — 1/3 endpoints used (list only)**

---

## Layer 2: Contract/Interface Matching

### Request/Response Schemas

| Endpoint | Frontend Sends | Backend Expects | Status |
|----------|---|---|---|
| **GET /warehouses** | (none) | (none) | ✅ Match |
| **GET /warehouses/:id/stock** | (none) | (none) | ✅ Match (but endpoint returns empty) |
| **POST /transfers** | Not called | `{ variantId: UUID, fromWarehouse: string, toWarehouse: string, qty: int>0, reference?: string }` | 🔴 Not implemented |

**Cross-check Detail (POST /transfers):**
```
Frontend:        (no form exists)
Backend expects: { variantId, fromWarehouse, toWarehouse, qty, reference? }
Status:          🔴 Mismatch — frontend form doesn't exist
```

---

## Layer 3: Existence & Navigation

| Item | Location | Status |
|------|----------|--------|
| **Backend Router** | `/apps/api/src/modules/warehouse/` | ✅ Exists |
| **Router Registration** | `/apps/api/src/index.ts:62` (`v1Router.use('/warehouse', warehouseRouter)`) | ✅ Registered |
| **Frontend Page** | `/apps/web/src/app/warehouse/page.tsx` | ✅ Exists |
| **Sidebar Nav Link** | `/apps/web/src/components/layout/Sidebar.tsx:51` | ✅ Present |
| **Nav Link Visibility** | Roles: `Owner`, `Admin`, `Warehouse Staff` | ✅ Correct |
| **Dashboard Quick Link** | `/apps/web/src/app/dashboard/page.tsx` | ✅ Links to `/warehouse` for Warehouse Staff role |

**Navigation Status:** ✅ **Full** — all links present and role-restricted correctly

---

## Gap Analysis with Impact

### Gap 1: `getWarehouseStock()` returns empty 🔴

**What's Missing:**
- Query in `warehouse.service.ts:87–98` has empty WHERE clause
- Cannot filter `inventory_movements` by warehouse ID

**Root Cause:**
- No `warehouse_id` or `location` field in database schema
- `reference` field exists but implementation to parse warehouse ID from it is incomplete

**Current Behavior:**
```
GET /api/v1/warehouse/warehouses/warehouse-gudang-a/stock
→ Returns [] (empty array, always)
```

**Impact:**
- **Severity:** 🔴 High (feature broken)
- **User Experience:** Warehouse staff cannot view inventory per warehouse location
- **Operational Impact:** Cannot determine stock distribution across warehouses

**Workaround:** Stock aggregation would need:
1. Add `warehouse_id` column to `inventory_movements` or `product_variants`
2. Or parse `reference` field convention reliably (current: incomplete)

---

### Gap 2: No UI for stock transfer 🔴

**What's Missing:**
- No form component to collect: variantId, fromWarehouse, toWarehouse, qty, reference
- No button/modal to trigger transfer
- No success/error feedback after POST

**Current State:**
- Backend endpoint ready (POST `/api/v1/warehouse/transfers`)
- Frontend page exists but contains no transfer form

**Impact:**
- **Severity:** 🔴 High (feature inaccessible)
- **User Experience:** Cannot perform stock transfers via UI
- **Operational Impact:** Stock transfers impossible unless done via API directly

---

### Gap 3: Picking & Packing tab is placeholder 🟡

**What's Missing:**
- No order picking list logic
- No integration with POS/orders module
- Static empty state only

**Impact:**
- **Severity:** 🟡 Medium (feature announced but non-functional)
- **User Experience:** Confusing UI element with no function
- **Operational Impact:** Warehouse staff see feature but cannot use it

---

### Gap 4: "Tambah Gudang" button has no handler 🟡

**What's Missing:**
- Button exists (line 53) but has no `onClick` handler
- No form/modal to add warehouse

**Impact:**
- **Severity:** 🟡 Low (warehouses are static config anyway)
- **User Experience:** Button appears clickable but does nothing
- **Operational Impact:** Warehouses must be added via code/config, not UI

---

## Detailed Integration Status

### Endpoint Coverage Matrix

| # | Endpoint | Backend | Frontend | Integration | Notes |
|---|----------|---------|----------|-------------|-------|
| 1 | `GET /warehouses` | ✅ Implemented | ✅ Called | ✅ Connected | List works correctly |
| 2 | `GET /warehouses/:id/stock` | 🟡 Stub | ❌ Not called | 🔴 Broken | Query returns empty; not wired to UI |
| 3 | `POST /transfers` | ✅ Implemented | ❌ Not called | 🔴 Missing | Endpoint ready but no form UI |

**Overall Coverage:** 1/3 endpoints used (33%)

---

## Database Schema Issues

### Current State

**inventory_movements** table:
```sql
id              UUID (primary key)
variant_id      UUID → product_variants
movement_type   ENUM ('SALE', 'PURCHASE', 'TRANSFER', 'RETURN', 'ADJUSTMENT')
qty             INTEGER (signed: negative for SALE/TRANSFER, positive for others)
reference       VARCHAR(255) ← Can store warehouse info but no schema constraint
reason          VARCHAR(500)
approved_by     UUID
performed_by    UUID
created_at      TIMESTAMP
```

**product_variants** table:
```sql
id              UUID
sku             VARCHAR
stock_qty       INTEGER (no warehouse split)
low_stock_threshold INTEGER
... (other fields)
```

### Schema Gaps for Warehouse Operations

1. **No warehouse location tracking**
   - `product_variants.stock_qty` is global, not per-warehouse
   - Transfers decrement global stock, cannot track warehouse-specific quantities

2. **No dedicated warehouse_stock table**
   - Would need: `{ warehouse_id, variant_id, qty, updated_at }`
   - Would split global `stock_qty` by location

3. **reference field is ad-hoc**
   - No validation of format
   - No foreign key to warehouses (which are static)
   - Warehouse attribution is unreliable (current implementation: broken)

---

## Code Quality & Architecture

### Strengths ✅

1. **Router registration proper** — warehouse router registered under `/api/v1/warehouse` prefix
2. **Zod validation complete** — POST /transfers validates payload fully
3. **RBAC in place** — all endpoints require role-based access
4. **Transactional updates** — transfers use `db.transaction()` to ensure atomicity
5. **Type safety** — frontend types match backend response structure (where implemented)
6. **Navigation UI correct** — sidebar links respect roles

### Weaknesses 🔴

1. **Incomplete service implementation** — `getWarehouseStock()` has empty WHERE clause (critical bug)
2. **No warehouse entity model** — static config only, no table
3. **Missing UI layer** — stock view and transfer form not built
4. **Picking feature incomplete** — announced but non-functional
5. **No tests** — no `warehouse.test.ts` or `warehouse.spec.ts` files exist
6. **Placeholder handlers** — UI buttons without click handlers

---

## Summary Table: Implementation Completeness

| Layer | Component | Status | Coverage |
|-------|-----------|--------|----------|
| **Backend** | Router | ✅ Full | 3/3 endpoints defined |
| **Backend** | Services | ⚠️ Partial | 2/3 fully working (stock query is stub) |
| **Backend** | Database | 🔴 Gap | No warehouse-specific stock table; no location field |
| **Frontend** | Page/Layout | ✅ Full | `/warehouse` page exists, sidebar link present |
| **Frontend** | API Calls | 🔴 Partial | Only 1/3 endpoints called (list warehouses) |
| **Frontend** | UI Components | 🔴 Partial | Cards for list, no transfer form, picking is stub |
| **Frontend** | Forms | ❌ None | No input forms for transfer or add warehouse |
| **Integration** | End-to-end Flow | 🔴 Broken | Stock view returns empty; transfers inaccessible |

---

## Recommendations (Priority Order)

### P0 — Critical (Blocks Core Functionality)

1. **Fix `getWarehouseStock()` query**
   - Add WHERE clause to actually filter by warehouse
   - Decision: either parse `reference` field reliably OR add `warehouse_id` column to schema

2. **Add stock transfer form to UI**
   - Create modal/form to collect: product (variant), from warehouse, to warehouse, qty
   - Integrate with `POST /api/v1/warehouse/transfers`
   - Add success/error feedback

### P1 — High (Important Feature Gap)

3. **Implement warehouse stock detail view**
   - Add click handler to warehouse card to navigate to detail page
   - Call `GET /api/v1/warehouse/warehouses/:id/stock` and display results in table
   - Show per-variant stock quantities

4. **Add "Tambah Gudang" functionality**
   - If warehouses should be dynamic: create modal form + POST endpoint
   - If static: remove button to reduce confusion

### P2 — Medium (Polish)

5. **Implement Picking & Packing feature**
   - Connect to orders module (POS)
   - Generate picking lists from pending orders
   - Track fulfillment status

6. **Add warehouse management tests**
   - Unit tests for transfer logic
   - Integration tests for end-to-end flow
   - Test edge cases (insufficient stock, invalid warehouse, etc.)

---

## Conclusion

**Status: ⚠️ Partial Implementation**

The warehouse module has a **solid backend foundation** (3 endpoints with proper RBAC and validation) but **incomplete frontend integration and a critical bug** in the stock retrieval service.

**What Works:**
- ✅ Warehouse list endpoint returns correct data
- ✅ Transfer endpoint validates payload and updates inventory correctly
- ✅ Navigation and role-based access control

**What Doesn't Work:**
- 🔴 Stock detail endpoint returns empty (query is broken)
- 🔴 No UI to view warehouse stock
- 🔴 No UI to perform stock transfers
- 🟡 Picking & Packing feature is not implemented

**Estimated Completion:**
- Fix stock query: 1–2 hours
- Build transfer form UI: 2–3 hours
- Build stock detail view: 2–3 hours
- Total: ~6–8 hours to reach ✅ **Full** status

