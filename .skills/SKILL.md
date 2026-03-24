# K21 - Teladan27 Motor (POS + Bengkel Management System)

## Project Overview

K21 is a monorepo POS & workshop management system for **Teladan27 Motor**, a motorcycle parts retail shop and service workshop in Bandung, Indonesia. The entire UI is in **Bahasa Indonesia**.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspace (`apps/web`, `apps/api`) |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | Express.js, TypeScript |
| ORM | Drizzle ORM |
| Database | PostgreSQL (localhost:5433, user: `appuser`, password: `k21devpass`, db: `k21`) |
| DB Driver | `postgres.js` (NOT `pg` / node-postgres) |
| Auth | JWT (jose library, HS256), access token in memory, refresh token in httpOnly cookie |

---

## Critical Rules (DO NOT VIOLATE)

### Database
- **Driver is `postgres.js`**, NOT `pg`. Import: `import postgres from 'postgres'`
- Raw SQL uses Drizzle's `sql` template literal: `db.execute(sql\`...\`)`
- Dynamic WHERE: use `sql.join(fragments, sql\` AND \`)` with array of `sql\`...\`` fragments
- **Users table**: column is `is_active` (NOT `active`), has `name` (nullable varchar 100) and `email`
- **Soft delete pattern**: suppliers/products use `active = false`, users use `is_active = false`
- Migrations are in `apps/api/drizzle/` as sequential `0000_...sql` to `0017_...sql`
- When user can't run `psql`, create Node.js migration scripts using `postgres` package

### Express Routes
- **Static routes MUST be registered BEFORE parameterized routes** (e.g., `/history` before `/:id`) to prevent Express matching literal strings as params
- All routes under `/api/v1/` prefix
- Auth middleware: `authenticate` (JWT verify), `requireRole('Cashier', 'Owner', 'Admin', ...)`
- 5 roles: `Owner`, `Admin`, `Finance`, `Warehouse Staff`, `Cashier`

### Frontend
- Two API call patterns coexist:
  - `authFetch` from `@/lib/auth-fetch` — returns raw `Response` (used in PaymentModal, etc.)
  - `apiGet`/`apiPost`/`apiPatch` from `@/lib/api` — returns `{ success, data, error }` (used in OrderDetailModal, etc.)
- **Do NOT mix them** — check which pattern the file already uses
- Auth state: `useAuth()` from `@/lib/auth` — returns `{ user, loading, logout }` where `user` has `sub`, `role`, `email`, `name`, `mustChangePassword`
- Shift state: `useShiftStore()` from `@/lib/store/shift.store` — returns `{ activeShift, setActiveShift }`
- Cart state: `useCartStore()` from `@/lib/store/cart.store`
- Currency format: `Rp ${n.toLocaleString('id-ID')}` — Indonesian locale throughout

### JWT Token Payload
```typescript
{ sub: userId, role, email, name?: string, mustChangePassword: boolean }
```
- `name` comes from the `users.name` column (nullable)
- Always accessed via `useAuth()` hook on frontend

---

## Project Structure

### Backend (`apps/api/`)
```
src/
  db/
    connection.ts          — postgres.js connection (reads DATABASE_URL from .env)
    schema/                — Drizzle table definitions
      index.ts             — re-exports all schemas
      users.ts, pos.ts, bengkel.ts, suppliers.ts, ...
  middleware/
    authenticate.ts        — JWT verification
    require-role.ts        — Role-based access control
    error-handler.ts       — Global error handler + resolveError()
  modules/
    auth/                  — Login, register, refresh token
    users/                 — User CRUD
    categories/            — Product categories
    products/              — Product + variant CRUD
    inventory/             — Stock movements, stock cache
    warehouse/             — Warehouse operations
    pos/                   — Transactions, payments, void, returns
    shifts/                — Shift open/close, cash transactions, history, daily report
    payroll/               — Employee payroll
    procurement/           — Purchase orders
    suppliers/             — Supplier CRUD (soft delete)
    analytics/             — Dashboard KPIs, revenue chart
    accounting/            — Journal entries, ledger
    marketplace/           — Online marketplace sync
    customers/             — Customer CRUD
    vehicles/              — Vehicle registry
    service-catalog/       — Service (jasa) catalog
    service-orders/        — Service orders, items, payments
    mechanics/             — Mechanic registry
    notifications/         — In-app notifications, notify by roles
    audit-logs/            — Audit log viewer
  queues/
    lowstock.queue.ts      — Low stock alert worker
drizzle/
  0000_*.sql ... 0017_*.sql — Sequential migrations
```

### Frontend (`apps/web/`)
```
src/
  app/                     — Next.js App Router pages
    pos/page.tsx           — Main POS page (split: retail left, service right)
    dashboard/page.tsx     — Dashboard with KPIs + charts
    products/              — Product management
    inventory/             — Inventory management
    shift-history/         — Shift history + daily cash report
    audit-logs/            — Audit log viewer
    ...
  components/
    layout/
      Sidebar.tsx          — Navigation sidebar + NotificationBell
      AppShell.tsx         — Layout wrapper
    pos/
      ProductPanel.tsx     — Product search + grid for retail POS
      PaymentModal.tsx     — Retail payment flow
      ReceiptModal.tsx     — Receipt display (thermal printer + WhatsApp)
      TransactionTable.tsx — Recent transactions table (clickable rows)
      OrderDetailModal.tsx — Transaction detail + void + retur buttons
      ReturnModal.tsx      — Partial return modal
      ShiftDrawer.tsx      — Shift open/close drawer
      CashTransactionModal.tsx — Kas masuk/keluar
    pos/service/
      ServiceFlow.tsx      — Service order flow (create → items → payment)
      ServiceProductSelector.tsx — Add jasa/sparepart to service order (with search)
      ServicePaymentModal.tsx — Service payment
      InlineServicePanel.tsx
    ui/
      NotificationBell.tsx — Notification dropdown with polling
    charts/
      RevenueChart.tsx     — Revenue + cash out chart
  lib/
    api.ts                 — apiGet/apiPost/apiPatch helpers
    auth-fetch.ts          — authFetch (raw fetch with token)
    auth.ts                — useAuth() hook (parses JWT)
    store/
      cart.store.ts        — Zustand cart store
      shift.store.ts       — Zustand shift store
    receipt/
      encoder.ts           — Thermal receipt encoder (ReceiptData type)
      webserial.ts         — WebSerial printer connection
      whatsapp.ts          — WhatsApp share URL builder
```

---

## Database Schema (Key Tables)

| Table | Key Columns | Notes |
|-------|------------|-------|
| `users` | id, email, password_hash, role, name, `is_active` | 5 roles, name is nullable |
| `products` | id, name, category_id, is_active | Soft delete via is_active |
| `product_variants` | id, product_id, sku, name, price, stock_qty | Each product has variants |
| `transactions` | id, client_uuid, shift_id, cashier_id, subtotal, discount_amount, total, status, note | status: COMPLETED/VOIDED |
| `transaction_items` | id, transaction_id, variant_id, qty, unit_price, discount_amount, line_total | |
| `transaction_payments` | id, transaction_id, method, amount, reference | method: CASH/TRANSFER/QRIS |
| `transaction_returns` | id, transaction_id, variant_id, qty, refund_amount, reason, performed_by | Partial returns |
| `shifts` | id, cashier_id, opening_float, closing_cash, status, opened_at, closed_at | status: OPEN/CLOSED |
| `shift_cash_transactions` | id, shift_id, type, amount, description, performed_by | type: CASH_IN/CASH_OUT |
| `service_orders` | id, order_number, vehicle_id, mechanic_id, work_status, payment_status, complaint | |
| `service_order_items` | id, service_order_id, item_type, description, qty, unit_price, line_total | item_type: SERVICE/PART |
| `service_payments` | id, service_order_id, method, amount, reference | |
| `suppliers` | id, name, contact, phone, email, address, notes, `active` | Soft delete via active |
| `notifications` | id, user_id, type, title, message, is_read | |
| `audit_logs` | id, user_id, action, table_name, record_id, old_value, new_value | |
| `journal_entries` | id, transaction_id, debit_account, credit_account, amount, description | Double-entry accounting |
| `stock_movements` | id, variant_id, movement_type, qty, reference_id | SALE, PURCHASE, RETURN, ADJUSTMENT |
| `service_catalog` | id, name, default_price, is_active | Jasa/service templates |
| `customers` | id, name, phone, email, address | |
| `vehicles` | id, customer_id, plate_number, brand, model, year | |
| `mechanics` | id, name, phone, specialization, is_active | |

---

## Store Info (Hardcoded)

```
Name:    Teladan27 Motor
Address: Jl. Budi No.2, Pasirkaliki, Kec. Cimahi Utara, Kota Bandung, Jawa Barat
Phone:   +62 858-4622-2290
```

---

## Existing Features (DO NOT re-build)

- POS Retail: product search, cart, multi-payment (CASH/TRANSFER/QRIS), discount per item/transaction
- POS Service/Bengkel: service order flow, vehicle registry, mechanic assignment, jasa + sparepart, inline jasa creation with search
- Receipt: thermal printer (WebSerial) + WhatsApp sharing + browser print fallback
- Shift management: open/close, kas masuk/keluar, reconciliation
- Shift history: paginated list + daily cash report
- Void transaction: full void with reason + stock restoration
- Retur/Refund parsial: per-item return with stock restoration
- Dashboard: KPIs (sales, revenue, transactions, cash in/out) + revenue chart
- Notifications: in-app with bell icon, polling, mark read
- Audit logs: filterable log viewer with JSON diff
- Inventory: stock movements, low stock alerts
- Procurement: purchase orders
- Products: CRUD with variants, categories
- Users: CRUD with role management
- Supplier management (backend CRUD done, frontend page pending)

---

## Pending / Not Yet Built

- Supplier management frontend page
- Spare parts search input in service order parts tab (state exists, UI added with search bar)

---

## Audit Methodology (Backend → Frontend Coverage)

Ketika diminta audit/cek coverage, WAJIB lakukan langkah berikut secara berurutan — jangan skip ke kesimpulan:

### Step 1 — Inventarisasi semua backend endpoints
Untuk setiap module di `apps/api/src/modules/`:
```
grep -n "Router\.(get|post|put|patch|delete)(" <module>.router.ts
```
Catat: method, path, roles yang dibutuhkan.

### Step 2 — Baca setiap frontend page/component yang relevan
Bukan hanya cek "apakah URL-nya ada", tapi baca:
- Semua `apiGet/apiPost/apiPatch/authFetch` calls → apakah semua endpoint backend dipanggil?
- Semua form submit handlers → apakah **field names** yang dikirim cocok dengan yang diharapkan API?
- Semua response handlers → apakah field dari response digunakan dengan nama yang benar?

### Step 3 — Baca backend service implementation
```
apps/api/src/modules/<name>/<name>.service.ts
```
Cek: apakah return data hardcoded/stub, atau benar query dari database?

### Step 4 — Buat matrix dengan format ini:
```
| # | Module | Routes (total) | Frontend | API Calls | Status | Gap |
| API Calls = X/Y (berapa dari total endpoint yang benar-benar dipanggil)
```

Status legend:
- ✅ Full — semua endpoint dipanggil, payload cocok
- ⚠️ Partial — ada endpoint tidak dipanggil atau payload mismatch minor
- 🔴 Missing — halaman tidak ada atau endpoint tidak pernah dipanggil
- 🟡 Stub — backend return hardcoded data

### Step 5 — Untuk setiap gap, catat:
- Endpoint mana yang hilang
- Payload mismatch spesifik (nama field yang salah)
- Dampak ke operasional (broken / degraded / cosmetic)

### Aturan penting saat audit:
- JANGAN bilang ✅ hanya karena halaman ada dan ada satu API call ke module itu
- WAJIB baca form submit code dan bandingkan field names dengan API schema
- WAJIB baca service implementation untuk deteksi stub/hardcoded
- Hitung coverage secara eksak: "2/7 endpoints", bukan hanya "partial"

---

## Common Patterns

### Adding a new API endpoint
1. Add service function in `modules/<name>/<name>.service.ts`
2. Add route in `modules/<name>/<name>.router.ts`
3. Register router in `src/index.ts` under v1Router
4. If new table needed: create migration in `drizzle/`, add schema in `db/schema/`, export from `index.ts`

### Adding a new page
1. Create `apps/web/src/app/<name>/page.tsx` with `'use client'`
2. Wrap in `<AppShell>` + `<Sidebar />`
3. Add nav item in `Sidebar.tsx` (NAV_MAIN or NAV_ADMIN with roles)

### Migration without psql
Create `apps/api/run-migration-XXXX.mjs` using `postgres` package:
```js
import postgres from 'postgres'
const sql = postgres('postgres://appuser:k21devpass@localhost:5433/k21')
// ... execute SQL
await sql.end()
```
