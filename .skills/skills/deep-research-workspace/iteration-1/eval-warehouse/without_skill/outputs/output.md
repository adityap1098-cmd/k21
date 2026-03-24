# Audit Warehouse Module - K21 Project
## Backend → Frontend Implementation Coverage

**Date:** 2026-03-22
**Project:** K21 (Teladan27 Motor POS + Bengkel Management System)
**Scope:** Warehouse module implementation from backend to frontend

---

## Executive Summary

The warehouse module has **PARTIAL implementation** with significant gaps between backend and frontend.

| Category | Status | Details |
|----------|--------|---------|
| **Backend Endpoints** | ✅ Implemented | 3 endpoints defined and registered |
| **Backend Services** | 🟡 Partial | Stub implementation with hardcoded data |
| **Frontend Page** | ⚠️ Partial | Page exists but only 1/3 endpoints are called |
| **Feature Coverage** | 🔴 Missing | Stock details & transfer features not implemented |
| **Overall Status** | 🔴 **INCOMPLETE** | ~33% coverage |

---

## Step 1: Backend Endpoints Inventory

### Warehouse Router (`apps/api/src/modules/warehouse/warehouse.router.ts`)

**Total Routes: 3**

| # | Method | Path | Handler | Required Roles | Status |
|---|--------|------|---------|---|---------|
| 1 | GET | `/warehouses` | `listWarehouses()` | Owner, Admin, Warehouse Staff | ✅ Implemented |
| 2 | GET | `/warehouses/:id/stock` | `getWarehouseStock(id)` | Owner, Admin, Warehouse Staff | 🟡 Stub |
| 3 | POST | `/transfers` | `transferStock(params)` | Owner, Admin, Warehouse Staff | 🟡 Stub |

**Registration:** ✅ Properly registered in `apps/api/src/index.ts` (line 62: `v1Router.use('/warehouse', warehouseRouter)`)

---

## Step 2: Backend Service Implementation Analysis

### File: `apps/api/src/modules/warehouse/warehouse.service.ts`

#### Issue #1: Warehouse List is Hardcoded (Lines 40-59)
```typescript
const WAREHOUSES: Warehouse[] = [
  { id: 'warehouse-gudang-a', name: 'Gudang A', address: 'Jl. Gudang, Jakarta', isActive: true },
  { id: 'warehouse-gudang-b', name: 'Gudang B', address: 'Jl. Gudang Alt, Jakarta', isActive: true },
  { id: 'warehouse-display-toko', name: 'Display Toko', address: 'Jl. Toko Utama, Jakarta', isActive: true },
]
```
**Impact:** No persistence layer; warehouses cannot be created/edited via API.

#### Issue #2: getWarehouseStock() is Broken (Lines 75-133)
**Critical Finding:** The function contains incomplete query logic:
- Lines 87-98: Empty WHERE clause `where(and())` — no actual filtering
- Lines 115: `where(and())` — again, empty filter
- Lines 130: Returns placeholder product names: `'Product for SKU ${v.sku}'` — should join with products table

**Root Cause:** The schema lacks a `warehouse_location` field in `inventory_movements`. The service tries to work around this by matching references starting with warehouse ID, but the query is never executed.

**Code Analysis:**
```typescript
// Line 87-98: movements query with empty WHERE
const movements = await db
  .select({ variantId: inventoryMovements.variantId, qty: inventoryMovements.qty })
  .from(inventoryMovements)
  .where(and())  // ❌ EMPTY — no filtering

// Line 107-115: variants query with empty WHERE
const variants = await db.select(...)
  .from(productVariants)
  .where(and())  // ❌ EMPTY — matches ALL variants, not those in warehouse
```

**Expected Behavior:** Should filter to only variants present in the requested warehouse.
**Actual Behavior:** Returns all product variants with generic stock values (placeholder implementation).

#### Issue #3: transferStock() References Missing Implementation (Lines 175-185)
- Calls `recordMovement()` with `movementType: 'TRANSFER'`
- Generates transfer reference: `transfer:{fromWarehouse}→{toWarehouse}`
- **Problem:** No warehouse location tracking in inventory_movements table
- No way to audit warehouse-specific stock levels after transfer

**Summary:** ✅ Basic logic exists, but warehouse tracking is not wired to the database schema.

---

## Step 3: Frontend Page Analysis

### File: `apps/web/src/app/warehouse/page.tsx`

#### API Call Coverage: **1/3 endpoints (33%)**

| Endpoint | Frontend Call | Status |
|----------|---------------|--------|
| `GET /warehouses` | ✅ Line 38 | **CALLED** |
| `GET /warehouses/:id/stock` | ❌ Never called | **MISSING** |
| `POST /transfers` | ❌ Never called | **MISSING** |

#### Frontend Implementation Details

**What is implemented:**
- ✅ List warehouses with name, address, active status
- ✅ Search/filter warehouses by name
- ✅ Tab UI for "Gudang & Lokasi" and "Picking & Packing"

**What is NOT implemented (stub/placeholder):**
- 🔴 "Tambah Gudang" button: No click handler or modal
- 🔴 "Picking List" button: No click handler
- 🔴 Warehouse stock details: No endpoint call for `/warehouses/:id/stock`
- 🔴 Stock transfer UI: No modal/form for POST `/transfers`
- 🔴 "Picking & Packing" tab: Only shows placeholder message

**Code Evidence:**

Lines 51-53 (buttons with no handlers):
```typescript
<Button variant="secondary" icon={<ClipboardList size={15} />}>Picking List</Button>
<Button icon={<Plus size={15} />}>Tambah Gudang</Button>
```
**Issue:** No `onClick` props — buttons are non-functional.

Lines 99-122 (warehouse cards):
```typescript
<Card key={w.id} className="...cursor-pointer">
  {/* Displays name, address, active status */}
  {/* Lines 116-120 show badge placeholders for ZONE/RACK/BIN */}
  {/* But no click handler to load stock or open transfer modal */}
</Card>
```
**Issue:** Cards are clickable visually but do nothing on click.

Lines 128-136 (picking tab):
```typescript
{activeTab === 'picking' && (
  <Card className="...">
    <PackageCheck size={32} className="text-ink-faint" />
    <p>Picking list akan muncul di sini...</p>
  </Card>
)}
```
**Issue:** Pure placeholder — no data loading or functionality.

#### Frontend Type Definitions

Lines 16-20:
```typescript
interface Warehouse {
  id: string; name: string; address: string | null; isActive: boolean
}
```
**Match Status:** ✅ Matches backend return type exactly.

---

## Step 4: Integration Matrix

### Coverage Summary

| # | Component | Status | Coverage | Details |
|---|-----------|--------|----------|---------|
| **Backend** | Warehouse Router | ✅ | 3/3 routes | All defined, registered |
| | Warehouse Service | 🟡 | 1/3 functions | `listWarehouses()` works; others stub/broken |
| | Database Schema | 🔴 | 0/1 warehouse tables | No `warehouses` table; no location tracking in movements |
| **Frontend** | Warehouse Page | ⚠️ | 1/3 endpoints called | Only `GET /warehouses` called |
| | Components | 🔴 | 0/2 features | No modal/form for add warehouse or transfer |
| | User Interactions | 🔴 | 0/4 buttons | All buttons non-functional |

### Endpoint Call Matrix

```
┌─────────────────────────────────────────────────────────┐
│ Backend Endpoint                                         │
├─────────────────────────────────────────────────────────┤
│ GET /api/v1/warehouse/warehouses                        │
│   → Frontend Call: YES (warehouse.page.tsx:38)          │
│   → Status: ✅ WORKING                                  │
├─────────────────────────────────────────────────────────┤
│ GET /api/v1/warehouse/warehouses/:id/stock              │
│   → Frontend Call: NO                                   │
│   → Status: 🔴 NOT IMPLEMENTED                          │
├─────────────────────────────────────────────────────────┤
│ POST /api/v1/warehouse/transfers                        │
│   → Frontend Call: NO                                   │
│   → Status: 🔴 NOT IMPLEMENTED                          │
└─────────────────────────────────────────────────────────┘
```

---

## Step 5: Detailed Gap Analysis

### Gap #1: Warehouse Stock Details Endpoint
**Severity:** 🔴 **CRITICAL**

| Aspect | Detail |
|--------|--------|
| **Endpoint** | `GET /warehouses/:id/stock` |
| **Backend** | Defined in router, service implementation is broken (empty WHERE clauses) |
| **Frontend** | No UI to call this endpoint; no modal/detail view |
| **Impact** | Users cannot see what products are in each warehouse |
| **Root Cause** | Missing schema: no `warehouse_location` field in `inventory_movements` table |
| **Fix Required** | (1) Add warehouse location tracking to DB schema, (2) Update service query, (3) Add detail modal to frontend |

**Backend Query Issues (warehouse.service.ts lines 87-98):**
```typescript
// Current: Empty WHERE clause
const movements = await db.select(...).from(inventoryMovements).where(and())

// Should be: Filter by warehouse location from reference
const movements = await db.select(...).from(inventoryMovements)
  .where(sql`reference LIKE ${`${warehouseId}:%`}`)
```

### Gap #2: Stock Transfer UI
**Severity:** 🔴 **CRITICAL**

| Aspect | Detail |
|--------|--------|
| **Endpoint** | `POST /transfers` |
| **Backend** | Defined and functional, records TRANSFER movement |
| **Frontend** | No UI/modal to submit transfer request |
| **Impact** | Cannot perform inter-warehouse stock transfers |
| **User Story** | "As Warehouse Staff, I want to move stock from Gudang A to Gudang B" |
| **Fix Required** | Create transfer modal with: from-warehouse select, to-warehouse select, variant search, qty input |

**Expected Request Body (from router validation, line 11-17):**
```typescript
{
  variantId: string (UUID),
  fromWarehouse: string (e.g., "warehouse-gudang-a"),
  toWarehouse: string (e.g., "warehouse-gudang-b"),
  qty: number (positive integer),
  reference?: string (optional)
}
```

### Gap #3: Warehouse CRUD Operations
**Severity:** 🔴 **CRITICAL**

| Aspect | Detail |
|--------|--------|
| **Operations** | Create, Update, Delete warehouse |
| **Backend** | No endpoints defined; warehouses hardcoded in service |
| **Frontend** | "Tambah Gudang" button has no handler |
| **Database** | No `warehouses` table in schema |
| **Impact** | Cannot add/modify warehouse locations; stuck with 3 hardcoded warehouses |
| **Fix Required** | (1) Create `warehouses` table, (2) Add CRUD endpoints, (3) Add forms/modals in frontend |

### Gap #4: Picking & Packing Feature
**Severity:** 🟡 **MEDIUM** (future feature)

| Aspect | Detail |
|--------|--------|
| **Status** | Marked as "future" in UI (placeholder message) |
| **Backend** | No endpoints defined |
| **Frontend** | Tab exists, shows placeholder only |
| **Impact** | Cosmetic; doesn't block warehouse basic operations |

---

## Step 6: Schema & Data Model Issues

### Current Schema State

| Table | Issue | Impact |
|-------|-------|--------|
| `inventory_movements` | No `warehouse_location` field | Cannot track which warehouse owns stock |
| `product_variants` | Single `stock_qty` column | All warehouses share same stock pool (incorrect) |
| `warehouses` | Table doesn't exist | Warehouses are hardcoded in service (not persistent) |

**Current Architecture:** GLOBAL STOCK MODEL (all warehouses share one stock qty)
```
┌─────────────────────────────────────────┐
│ Product Variant                         │
├─────────────────────────────────────────┤
│ id: UUID                                │
│ sku: VARCHAR                            │
│ stock_qty: INTEGER (GLOBAL, NOT PER-WH) │
└─────────────────────────────────────────┘
```

**Required Architecture:** PER-WAREHOUSE STOCK MODEL
```
┌──────────────────────────┐     ┌──────────────────────────┐
│ Warehouse                │     │ Warehouse Stock          │
├──────────────────────────┤     ├──────────────────────────┤
│ id: UUID                 │     │ id: UUID                 │
│ name: VARCHAR            │────→│ warehouse_id: FK         │
│ address: VARCHAR         │     │ variant_id: FK           │
│ is_active: BOOLEAN       │     │ qty: INTEGER (per-wh)    │
└──────────────────────────┘     └──────────────────────────┘
```

---

## Step 7: Code Quality & Implementation Issues

### Issue #1: Hardcoded Warehouse List
**File:** `warehouse.service.ts` lines 40-59
**Severity:** 🔴 CRITICAL

Warehouses are immutable constants:
- Cannot be created/updated/deleted via API
- Warehouse IDs are opaque strings (`warehouse-gudang-a`)
- No way to add new warehouses without code changes

### Issue #2: Incomplete Query Logic
**File:** `warehouse.service.ts` lines 87-98, 107-115
**Severity:** 🔴 CRITICAL

Empty WHERE clauses in database queries:
```typescript
.where(and())  // Matches everything, filters nothing
```

This is a query construction error that would need debugging to catch.

### Issue #3: Missing Product Name Join
**File:** `warehouse.service.ts` line 130
**Severity:** 🟡 MEDIUM

Placeholder instead of actual product name:
```typescript
productName: `Product for SKU ${v.sku}`, // Should join with products table
```

### Issue #4: Non-Functional UI Buttons
**File:** `warehouse/page.tsx` lines 51-53
**Severity:** 🟡 MEDIUM

```typescript
<Button icon={<Plus size={15} />}>Tambah Gudang</Button>
// ↑ No onClick handler
```

Users may attempt to click these buttons, leading to confusion.

### Issue #5: No Modal/Form Components
**Severity:** 🔴 CRITICAL

Missing components:
- `WarehouseForm` (for add/edit warehouse)
- `TransferModal` (for stock transfers)
- `WarehouseStockModal` (for viewing warehouse inventory detail)

These should follow existing patterns in the codebase:
- `components/forms/UserForm.tsx` (for user CRUD)
- `components/pos/PaymentModal.tsx` (for modals)

---

## Step 8: Navigation & Integration

### Sidebar Registration
**File:** `apps/web/src/components/layout/Sidebar.tsx` line 51
**Status:** ✅ Properly registered

```typescript
{ href: '/warehouse', label: 'Warehouse', icon: Warehouse, roles: ['Owner', 'Admin', 'Warehouse Staff'] }
```

### Dashboard Link
**File:** `apps/web/src/app/dashboard/page.tsx` line 366
**Status:** ✅ Dashboard has "Warehouse" button that routes to `/warehouse`

---

## Compliance with Project Standards

### API Naming & Pattern
| Standard | Required | Implementation | Status |
|----------|----------|---|--------|
| Route prefix | `/api/v1/` | ✅ Used | ✅ PASS |
| Authentication | `authenticate` middleware | ✅ Applied | ✅ PASS |
| Role-based access | `requireRole(...)` | ✅ Applied | ✅ PASS |
| Response format | `{ success, data, error }` | ✅ Used | ✅ PASS |
| Zod validation | Request body schema | ✅ Used for transfers | ✅ PASS |

### Frontend Patterns
| Pattern | Required | Implementation | Status |
|---------|----------|---|--------|
| `useClient` directive | Required in client components | ✅ Line 1 | ✅ PASS |
| `DashboardLayout` wrapper | Required for pages | ✅ Used | ✅ PASS |
| API call method | `apiGet`/`apiPost` | ✅ `apiGet` used | ✅ PASS |
| Locale (Indonesian) | All UI text in `id-ID` | ✅ Used | ✅ PASS |
| Component re-use | Use UI library components | ✅ Card, Button, Badge, Input | ✅ PASS |

---

## Recommendations by Priority

### Priority 1: Critical Fixes (Blocking)

#### 1a. Add Warehouse Persistence
**Why:** Warehouses are currently hardcoded; cannot be managed via UI
**What:**
1. Create `warehouses` table with: id, name, address, is_active, created_at, updated_at
2. Add CRUD endpoints: GET (list), GET/:id, POST, PATCH/:id, DELETE/:id
3. Replace hardcoded array with database queries

**Effort:** ~2-3 hours

#### 1b. Fix getWarehouseStock() Query
**Why:** Endpoint exists but returns wrong data (all variants, not warehouse-specific)
**What:**
1. Add `warehouse_location` field to `inventory_movements` table OR
2. Create separate `warehouse_stock` table to track qty per (warehouse, variant) pair
3. Rewrite service function to query correctly

**Effort:** ~2-3 hours

#### 1c. Add Stock Transfer UI
**Why:** Backend endpoint exists but has no UI
**What:**
1. Create `TransferModal` component with form
2. Wire "transfer" button/action in warehouse detail or inventory views
3. Handle success/error responses

**Effort:** ~2 hours

### Priority 2: Important Features (High-Value)

#### 2a. Add Warehouse Detail/Stock View
**Why:** Users can list warehouses but cannot see what's in each
**What:**
1. Create warehouse detail view/modal showing product variants and quantities
2. Call `GET /warehouses/:id/stock` when modal opens
3. Display products in table with columns: SKU, Product Name, Qty

**Effort:** ~1.5 hours

#### 2b. Add Warehouse Create/Edit
**Why:** "Tambah Gudang" button is non-functional
**What:**
1. Create `WarehouseForm` modal component
2. Handle success/error
3. Refresh warehouse list after create/edit

**Effort:** ~2 hours

### Priority 3: Nice-to-Have (Medium Value)

#### 3a. Implement Picking & Packing Tab
**Why:** Helps with order fulfillment workflow
**What:**
1. Design picking list UI (based on pending orders)
2. Create backend endpoint to generate picking lists
3. Add mark-as-picked functionality

**Effort:** ~3-4 hours

#### 3b. Warehouse Location Hierarchy (ZONE/RACK/BIN)
**Why:** UI already shows these badges; should support full hierarchy
**What:**
1. Create location hierarchy tables: zones, racks, bins
2. Track inventory by bin location (very granular)
3. Add location picker to stock transfer

**Effort:** ~4-5 hours (future feature)

---

## Detailed Findings Summary

### What's Working ✅
- Backend router properly registered in main app
- Endpoint for listing warehouses is implemented and called
- Frontend page has proper UI structure and styling
- Role-based access control correctly applied (Owner/Admin/Warehouse Staff)
- Navigation sidebar has warehouse link

### What's Broken 🔴
- `getWarehouseStock()` service has empty WHERE clauses and returns wrong data
- `transferStock()` has no UI to call it
- Warehouses are hardcoded constants, not stored in database
- "Tambah Gudang" and "Picking List" buttons have no handlers
- No modals/forms for warehouse CRUD or stock transfers
- Warehouse stock is not tracked per-warehouse (no schema support)

### What's Incomplete 🟡
- Picking & packing feature (placeholder tab only)
- Product name not joined in warehouse stock response
- Warehouse location hierarchy (ZONE/RACK/BIN) shown in UI but not backed by data

---

## Testing Notes

**To verify broken functionality:**

1. **Call GET /warehouses** → ✅ Should return 3 hardcoded warehouses
2. **Call GET /warehouses/warehouse-gudang-a/stock** → 🔴 Will return all variants (not filtered by warehouse)
3. **Call POST /transfers** → ✅ API works, but no UI to test
4. **Click "Tambah Gudang" button** → 🔴 Nothing happens
5. **Click "Picking List" button** → 🔴 Nothing happens

---

## Conclusion

**Overall Implementation Status: 🔴 INCOMPLETE (33% coverage)**

The warehouse module has a reasonable foundation:
- Backend router and basic endpoints are defined
- Frontend page structure exists
- Navigation is wired

However, it is **not production-ready** due to:
1. Critical data model gaps (no persistent warehouses, no per-warehouse stock tracking)
2. Incomplete frontend implementation (2/3 endpoints not called, critical buttons non-functional)
3. Stub implementations in backend service (empty queries, hardcoded data)

**Time to Production:** ~8-12 hours of focused development work to resolve all Priority 1 & 2 issues.

**Recommendation:** Address Priority 1 items before the warehouse module can be used in production.
