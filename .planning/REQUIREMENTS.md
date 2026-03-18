# Requirements: K21 Retail ERP

**Defined:** 2026-03-14
**Core Value:** Zero inventory discrepancy — setiap pergerakan stok dari sumber manapun tercatat dalam immutable audit trail

## v1 Requirements

### Infrastructure (INFRA)

- [x] **INFRA-01**: System dapat di-deploy ke single VPS menggunakan Docker Compose (Nginx, SSL Let's Encrypt, auto-renew)
- [x] **INFRA-02**: Database PostgreSQL berjalan dengan PgBouncer connection pooling (TRANSACTION mode, `postgres.js` driver)
- [x] **INFRA-03**: Redis tersedia sebagai cache layer dan BullMQ job queue storage
- [x] **INFRA-04**: CI/CD pipeline berjalan via GitHub Actions — auto-deploy ke VPS via SSH on push ke main
- [x] **INFRA-05**: Docker log rotation dikonfigurasi pada semua services (max-size: 10m, max-file: 5)
- [x] **INFRA-06**: Backup otomatis database setiap malam — pg_dump + gzip + enkripsi GPG + upload ke Backblaze B2
- [x] **INFRA-07**: Retention policy backup: simpan 7 hari terakhir, hapus otomatis yang lebih lama
- [x] **INFRA-08**: Monitoring aktif: UptimeRobot (external ping) + Netdata (internal CPU/RAM/Disk, bind ke localhost saja)

### Authentication & Access Control (AUTH)

- [x] **AUTH-01**: User dapat login dengan email dan password
- [x] **AUTH-02**: Session dikelola dengan JWT access token + refresh token (access token expiry pendek)
- [x] **AUTH-03**: User dapat logout dan invalidate session
- [x] **AUTH-04**: RBAC diterapkan dengan 5 role: Owner, Finance, Warehouse Staff, Cashier, Admin
- [x] **AUTH-05**: Setiap endpoint diproteksi sesuai permission role yang sesuai
- [x] **AUTH-06**: Admin dapat membuat, mengedit, dan menonaktifkan user
- [x] **AUTH-07**: Semua API endpoint menggunakan prefix `/api/v1/`
- [x] **AUTH-08**: Semua perubahan data penting (CREATE/UPDATE/DELETE) tercatat di `audit_logs` dengan user_id, action, old_value, new_value, ip_address, timestamp

### Product & Inventory (PROD / INV)

- [x] **PROD-01**: User dapat membuat produk dengan nama, SKU, barcode, kategori, dan harga jual
- [x] **PROD-02**: Produk mendukung variant (ukuran, warna, dll.) dengan stok terpisah per variant
- [x] **PROD-03**: Produk memiliki field klasifikasi PPN (kena pajak / tidak) untuk kebutuhan finance
- [x] **INV-01**: Sistem melacak stok real-time per produk/variant dengan Redis cache
- [x] **INV-02**: Setiap perubahan stok menghasilkan `inventory_movement` record yang tidak dapat dihapus (append-only)
- [x] **INV-03**: Tipe movement yang didukung: SALE, PURCHASE, TRANSFER, RETURN, ADJUSTMENT
- [x] **INV-04**: ADJUSTMENT wajib menyertakan alasan dan approver
- [x] **INV-05**: Decrement stok menggunakan `SELECT ... FOR UPDATE` dalam satu PostgreSQL transaction untuk mencegah oversell
- [x] **INV-06**: Sistem mendukung stock reservation untuk order confirmed yang belum dikirim
- [x] **INV-07**: Low stock alert dikirim otomatis saat stok di bawah threshold yang dikonfigurasi
- [x] **INV-08**: User dapat melakukan stock opname (input hitungan fisik) dan sistem menghasilkan ADJUSTMENT movement otomatis untuk selisih

### POS — Point of Sale (POS)

- [x] **POS-01**: Kasir dapat scan barcode produk atau cari manual untuk tambah ke cart
- [x] **POS-02**: Kasir dapat tambah, kurangi, hapus item di cart, dan terapkan diskon per item
- [x] **POS-03**: Transaksi mendukung multi-payment: tunai, transfer bank, dan QRIS
- [x] **POS-04**: Setiap transaksi selesai menghasilkan receipt (cetak dan/atau digital)
- [x] **POS-05**: Kasir dapat membuka dan menutup shift dengan rekap total transaksi dan selisih kas
- [x] **POS-06**: Kasir dapat void/cancel transaksi yang sudah selesai (dengan alasan, tercatat di audit log)
- [x] **POS-07**: POS berjalan sebagai PWA dengan Service Worker — aset ter-cache untuk offline access
- [x] **POS-08**: Transaksi yang dibuat saat offline tersimpan di IndexedDB browser
- [x] **POS-09**: Saat koneksi pulih, transaksi offline auto-sync ke server dengan idempotency key (`client_uuid`) — tidak ada duplikasi
- [x] **POS-10**: Server memvalidasi stok saat sync transaksi offline; konflik diflag untuk resolusi kasir
- [x] **POS-11**: Setiap transaksi POS selesai otomatis menghasilkan `inventory_movement(SALE)` dan `journal_entry` dalam satu atomic DB transaction

### Warehouse Management (WH)

- [ ] **WH-01**: Sistem mendukung hierarki lokasi: Warehouse → Zone → Rack → Bin
- [ ] **WH-02**: Warehouse staff dapat menerima barang dari Purchase Order dan assign ke lokasi fisik
- [ ] **WH-03**: Sistem menghasilkan picking list untuk persiapan pengiriman order
- [ ] **WH-04**: Warehouse staff dapat menjalankan packing workflow sebelum barang keluar gudang

### Procurement (PROC)

- [ ] **PROC-01**: User dapat membuat Purchase Order dengan supplier, item, dan kuantitas
- [ ] **PROC-02**: Purchase Order memerlukan approval dari Owner atau Admin sebelum dikirim ke supplier
- [ ] **PROC-03**: Warehouse staff dapat melakukan goods receipt dari PO yang sudah diapprove
- [ ] **PROC-04**: Goods receipt mendukung partial receive (satu PO bisa diterima dalam beberapa kali pengiriman)
- [ ] **PROC-05**: Goods receipt otomatis menghasilkan `inventory_movement(PURCHASE)` dan menutup PO jika sudah fully received

### Marketplace Integration (MKT)

- [ ] **MKT-01**: Sistem mengimport order dari Shopee secara otomatis via webhook dan polling
- [ ] **MKT-02**: Sistem mengimport order dari TikTok Shop secara otomatis via webhook dan polling
- [ ] **MKT-03**: Stok di ERP tersinkronisasi ke Shopee dan TikTok Shop secara dua arah
- [ ] **MKT-04**: Event `order.created` mengurangi stok via reservation; `order.cancelled` mengembalikan reservation; `order.shipped` mengubah reservation menjadi `inventory_movement(SALE)`
- [ ] **MKT-05**: Semua marketplace sync dan order processing berjalan sebagai BullMQ background jobs — tidak memblok API utama
- [ ] **MKT-06**: Webhook handler memvalidasi HMAC signature, menyimpan raw payload ke `webhook_events`, enqueue ke BullMQ, dan return 200 dalam < 100ms
- [ ] **MKT-07**: `webhook_events` memiliki UNIQUE constraint pada `(platform, event_type, event_id)` untuk mencegah pemrosesan duplikat
- [ ] **MKT-08**: OAuth token untuk setiap marketplace platform di-refresh otomatis sebelum expired — sync tidak berhenti karena token kedaluwarsa

### Finance & Accounting (FIN)

- [ ] **FIN-01**: Sistem menggunakan double-entry accounting — setiap transaksi bisnis otomatis menghasilkan journal entry yang seimbang
- [ ] **FIN-02**: Setiap commit `journal_entry` memvalidasi `SUM(debits) == SUM(credits)` sebelum transaction PostgreSQL commit
- [ ] **FIN-03**: Journal entry otomatis dihasilkan untuk: POS sale (tunai & QRIS), marketplace sale, purchase order, pembayaran ke supplier, payroll
- [ ] **FIN-04**: Chart of Accounts dapat dikonfigurasi oleh Owner/Finance via UI
- [ ] **FIN-05**: Sistem menghasilkan Profit & Loss report per periode
- [ ] **FIN-06**: Sistem menghasilkan Balance Sheet per tanggal tertentu
- [ ] **FIN-07**: Sistem menghasilkan Cash Flow Statement per periode
- [ ] **FIN-08**: Laporan dapat difilter per produk dan per channel (POS / Shopee / TikTok Shop)
- [ ] **FIN-09**: Schema produk dan transaksi menyertakan field klasifikasi PPN untuk kebutuhan compliance masa depan

### Payroll (PAY)

- [ ] **PAY-01**: Finance dapat menginput komponen gaji per karyawan: gaji pokok, bonus, tunjangan
- [ ] **PAY-02**: Sistem menghitung potongan BPJS Kesehatan dan BPJS Ketenagakerjaan sesuai regulasi
- [ ] **PAY-03**: Sistem menghitung PPh 21 menggunakan metode TER (PMK 168/2023) dengan lookup table TER A/B/C
- [ ] **PAY-04**: Finance dapat memproses payroll bulanan dan menghasilkan slip gaji per karyawan
- [ ] **PAY-05**: Slip gaji dapat diekspor sebagai PDF
- [ ] **PAY-06**: Payroll yang diproses otomatis menghasilkan journal entry (Debit: Salary Expense / Credit: Cash)

### Analytics (ANL)

- [ ] **ANL-01**: Dashboard menampilkan KPI real-time: revenue hari ini, margin, dan level stok kritis
- [ ] **ANL-02**: User dapat melihat sales trend per produk dan per channel (POS / marketplace)
- [ ] **ANL-03**: User dapat melihat laporan performa marketplace (order volume, cancellation rate per platform)
- [ ] **ANL-04**: Generate laporan besar berjalan sebagai BullMQ background job — tidak timeout di browser

## v2 Requirements

### Notifications
- **NOTF-01**: Push notification / email alert untuk low stock, order baru marketplace, dan PO yang butuh approval
- **NOTF-02**: User dapat konfigurasi preferensi notifikasi per event type

### Moderation & Advanced Admin
- **MOD-01**: Admin dapat melihat activity log per user
- **MOD-02**: Owner dapat export semua data (audit trail, transaksi) untuk keperluan eksternal

### Marketplace Expansion
- **MKT-EXT-01**: Integrasi Tokopedia
- **MKT-EXT-02**: Integrasi Lazada

### Advanced Finance
- **FIN-ADV-01**: PPN output/input tax enforcement dengan laporan SPT masa
- **FIN-ADV-02**: Marketplace payout reconciliation (booking settlement aktual dari platform)
- **FIN-ADV-03**: AR aging report untuk piutang marketplace

## Out of Scope

| Feature | Reason |
|---|---|
| Mobile native app (iOS/Android) | PWA sudah memenuhi kebutuhan; native app butuh biaya tinggi |
| Multi-tenant / multi-store | Sistem ini untuk satu perusahaan; multi-tenant butuh arsitektur berbeda |
| Real-time chat antar karyawan | Bukan core ERP; gunakan WhatsApp |
| Microservices deployment | Monolith dengan domain boundaries cukup untuk skala saat ini |
| E-commerce website toko sendiri | Penjualan online via Shopee & TikTok Shop sudah cukup |
| Loyalty program / member points | Kompleksitas tinggi, bukan prioritas v1 |

## Traceability

| Requirement | Phase | Status |
|---|---|---|
| INFRA-01 | Phase 0: Infrastructure | Complete |
| INFRA-02 | Phase 0: Infrastructure | Complete |
| INFRA-03 | Phase 0: Infrastructure | Complete |
| INFRA-04 | Phase 0: Infrastructure | Complete |
| INFRA-05 | Phase 0: Infrastructure | Complete |
| INFRA-06 | Phase 0: Infrastructure | Complete |
| INFRA-07 | Phase 0: Infrastructure | Complete |
| INFRA-08 | Phase 0: Infrastructure | Complete |
| AUTH-01 | Phase 1: Auth & RBAC | Complete |
| AUTH-02 | Phase 1: Auth & RBAC | Complete |
| AUTH-03 | Phase 1: Auth & RBAC | Complete |
| AUTH-04 | Phase 1: Auth & RBAC | Complete |
| AUTH-05 | Phase 1: Auth & RBAC | Complete |
| AUTH-06 | Phase 1: Auth & RBAC | Complete |
| AUTH-07 | Phase 1: Auth & RBAC | Complete |
| AUTH-08 | Phase 1: Auth & RBAC | Complete |
| PROD-01 | Phase 2: Product & Inventory | Complete |
| PROD-02 | Phase 2: Product & Inventory | Complete |
| PROD-03 | Phase 2: Product & Inventory | Complete |
| INV-01 | Phase 2: Product & Inventory | Complete |
| INV-02 | Phase 2: Product & Inventory | Complete |
| INV-03 | Phase 2: Product & Inventory | Complete |
| INV-04 | Phase 2: Product & Inventory | Complete |
| INV-05 | Phase 2: Product & Inventory | Complete |
| INV-06 | Phase 2: Product & Inventory | Complete |
| INV-07 | Phase 2: Product & Inventory | Complete |
| INV-08 | Phase 2: Product & Inventory | Complete |
| POS-01 | Phase 3: POS with Offline Mode | Complete |
| POS-02 | Phase 3: POS with Offline Mode | Complete |
| POS-03 | Phase 3: POS with Offline Mode | Complete |
| POS-04 | Phase 3: POS with Offline Mode | Complete |
| POS-05 | Phase 3: POS with Offline Mode | Complete |
| POS-06 | Phase 3: POS with Offline Mode | Complete |
| POS-07 | Phase 3: POS with Offline Mode | Complete |
| POS-08 | Phase 3: POS with Offline Mode | Complete |
| POS-09 | Phase 3: POS with Offline Mode | Complete |
| POS-10 | Phase 3: POS with Offline Mode | Complete |
| POS-11 | Phase 3: POS with Offline Mode | Complete |
| PROC-01 | Phase 4: Procurement | Pending |
| PROC-02 | Phase 4: Procurement | Pending |
| PROC-03 | Phase 4: Procurement | Pending |
| PROC-04 | Phase 4: Procurement | Pending |
| PROC-05 | Phase 4: Procurement | Pending |
| WH-01 | Phase 5: Warehouse Management | Pending |
| WH-02 | Phase 5: Warehouse Management | Pending |
| WH-03 | Phase 5: Warehouse Management | Pending |
| WH-04 | Phase 5: Warehouse Management | Pending |
| MKT-01 | Phase 6: Marketplace Integration | Pending |
| MKT-02 | Phase 6: Marketplace Integration | Pending |
| MKT-03 | Phase 6: Marketplace Integration | Pending |
| MKT-04 | Phase 6: Marketplace Integration | Pending |
| MKT-05 | Phase 6: Marketplace Integration | Pending |
| MKT-06 | Phase 6: Marketplace Integration | Pending |
| MKT-07 | Phase 6: Marketplace Integration | Pending |
| MKT-08 | Phase 6: Marketplace Integration | Pending |
| FIN-01 | Phase 7: Finance & Accounting | Pending |
| FIN-02 | Phase 7: Finance & Accounting | Pending |
| FIN-03 | Phase 7: Finance & Accounting | Pending |
| FIN-04 | Phase 7: Finance & Accounting | Pending |
| FIN-05 | Phase 7: Finance & Accounting | Pending |
| FIN-06 | Phase 7: Finance & Accounting | Pending |
| FIN-07 | Phase 7: Finance & Accounting | Pending |
| FIN-08 | Phase 7: Finance & Accounting | Pending |
| FIN-09 | Phase 7: Finance & Accounting | Pending |
| PAY-01 | Phase 8: Payroll | Pending |
| PAY-02 | Phase 8: Payroll | Pending |
| PAY-03 | Phase 8: Payroll | Pending |
| PAY-04 | Phase 8: Payroll | Pending |
| PAY-05 | Phase 8: Payroll | Pending |
| PAY-06 | Phase 8: Payroll | Pending |
| ANL-01 | Phase 9: Analytics | Pending |
| ANL-02 | Phase 9: Analytics | Pending |
| ANL-03 | Phase 9: Analytics | Pending |
| ANL-04 | Phase 9: Analytics | Pending |

**Coverage:**
- v1 requirements: 63 total
- Mapped to phases: 63/63
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 — traceability table completed after roadmap creation*
