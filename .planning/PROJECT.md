# K21 Retail ERP

## What This Is

K21 adalah sistem ERP retail terpadu yang dibangun untuk mendukung operasional toko fisik dan marketplace milik satu perusahaan retail kecil (±10 karyawan). Sistem ini menggantikan aplikasi kasir sederhana yang sudah tidak mencukupi kebutuhan bisnis yang berkembang, dengan mengintegrasikan POS, inventory, warehouse, procurement, marketplace (Shopee & TikTok Shop), keuangan, payroll, dan analytics dalam satu platform terpusat yang berjalan di atas infrastruktur minimal (single VPS, Docker Compose).

## Core Value

Zero inventory discrepancy — setiap pergerakan stok dari sumber manapun (POS, marketplace, warehouse, adjustment) tercatat dalam immutable audit trail, sehingga selisih stok dapat ditelusuri hingga ke transaksi asal.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Infrastructure & Foundation**
- [ ] VPS deployment dengan Docker Compose (Nginx, SSL, PgBouncer, Redis, Netdata)
- [ ] CI/CD pipeline via GitHub Actions → SSH deploy
- [ ] Log rotation pada semua Docker services
- [ ] Encrypted backup otomatis ke Backblaze B2 (GPG, 7-day retention)

**Auth & Access Control**
- [ ] Authentication dengan JWT + refresh token
- [ ] RBAC: 5 role (Owner, Finance, Warehouse Staff, Cashier, Admin)
- [ ] API versioning `/api/v1/` dari awal

**Product & Inventory**
- [ ] Product catalog dengan variant support
- [ ] Real-time inventory tracking dengan Redis cache
- [ ] Inventory movement log (append-only): SALE, PURCHASE, TRANSFER, RETURN, ADJUSTMENT
- [ ] Stock reservation untuk confirmed orders belum dikirim
- [ ] Low stock alert otomatis
- [ ] Full audit log pada semua perubahan data penting

**POS (Point of Sale)**
- [ ] Barcode scan + manual search
- [ ] Cart management + multi-payment (tunai, transfer, QRIS)
- [ ] Receipt generation (print + digital)
- [ ] Shift management (open/close dengan rekap)
- [ ] **OFFLINE MODE:** PWA + Service Worker + IndexedDB
- [ ] Auto-sync transaksi offline saat koneksi pulih
- [ ] Setiap transaksi otomatis hasilkan inventory_movement + journal_entry

**Warehouse Management**
- [ ] Hierarki lokasi: Warehouse → Zone → Rack → Bin
- [ ] Receive goods dari Purchase Order
- [ ] Picking list & packing workflow

**Procurement**
- [ ] Purchase Order creation + approval workflow (Owner/Admin)
- [ ] Goods receipt → auto update inventory

**Marketplace Integration**
- [ ] Shopee integration: order import, inventory sync, shipment tracking, webhook
- [ ] TikTok Shop integration: order import, inventory sync, shipment tracking, webhook
- [ ] Background jobs via BullMQ (tidak memblok API utama)
- [ ] Event handling: order.created, order.cancelled, order.shipped

**Finance & Accounting**
- [ ] Double-entry accounting dengan auto journal entry
- [ ] Journal otomatis: POS sale, marketplace sale, purchase, payment ke supplier, payroll
- [ ] Laporan: P&L, Balance Sheet, Cash Flow
- [ ] Laporan per periode, per produk, per channel

**Payroll**
- [ ] Kalkulasi gaji pokok + bonus + tunjangan
- [ ] Potongan BPJS + pinjaman
- [ ] Kalkulasi pajak PPh 21
- [ ] Export slip gaji

**Analytics**
- [ ] Dashboard KPI real-time (revenue, margin, stok)
- [ ] Sales trend per produk / per channel
- [ ] Laporan performa marketplace
- [ ] Background job untuk generate laporan besar

### Out of Scope

- Mobile native app — web PWA sudah cukup untuk kebutuhan saat ini
- Multi-tenant / multi-store — sistem ini untuk satu toko/perusahaan
- Marketplace lain (Lazada, Tokopedia) — fase pertama hanya Shopee + TikTok Shop
- Microservices — monolith dengan domain boundaries yang jelas, extract ke microservices hanya jika bisnis berkembang signifikan

## Context

- **Existing system:** Aplikasi kasir sederhana (POS only, tanpa inventory/finance/marketplace)
- **Team size:** ±10 karyawan, 5 role berbeda
- **All pain points are real:** Inventory chaos, marketplace manual copy-paste, no financial visibility, POS reliability — semua harus diselesaikan sistem ini
- **Budget constraint:** Infrastruktur ≤ Rp500.000/bulan; target realistis ±Rp292.000/bulan (Hetzner CX32)
- **Critical requirement:** POS harus support offline mode — kasir tetap bisa transaksi jika internet mati

## Constraints

- **Budget:** Infrastruktur ≤ Rp500.000/bulan — single VPS, tidak ada managed services berbayar
- **Architecture:** Monolith (satu codebase, satu VPS) — domain-driven boundaries agar bisa di-extract nanti
- **Stack (locked):** Node.js + Express.js + TypeScript, Next.js, PostgreSQL, Redis, BullMQ, Drizzle ORM, Docker Compose
- **Security:** Data keuangan sensitif — HTTPS end-to-end, RBAC ketat, audit log wajib, backup terenkripsi
- **Timeline:** Tidak ada hard deadline — build it right, phase by phase

## Key Decisions

| Decision | Rationale | Outcome |
|---|---|---|
| Monolith over microservices | Biaya rendah, tim kecil, domain boundaries tetap bersih untuk future extract | — Pending |
| BullMQ untuk async jobs | Marketplace sync & laporan tidak boleh memblok API — Redis sudah ada, tidak perlu service baru | — Pending |
| POS sebagai PWA + IndexedDB | Offline mode wajib — kasir tidak boleh berhenti jika internet mati | — Pending |
| PgBouncer connection pooling | Single VPS, cegah DB connection exhaustion saat load tinggi | — Pending |
| Inventory movement log append-only | Zero discrepancy goal — tidak boleh ada perubahan stok yang tidak tercatat | — Pending |
| Double-entry accounting otomatis | Setiap transaksi bisnis langsung hasilkan journal entry — tidak manual | — Pending |
| API versioning dari Phase 0 | Future-proof untuk integrasi baru dan perubahan API tanpa breaking change | — Pending |

---
*Last updated: 2026-03-14 after initialization*
