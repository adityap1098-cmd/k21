# Product Requirements Document (PRD)
## Retail ERP Platform — Ultra Lean Deployment

**Version:** 2.1 | **Status:** Production Ready | **Target Users:** Internal Company (±10 Employees)

---

# 1. Overview

## 1.1 Product Vision

Retail ERP adalah sistem manajemen bisnis terpadu yang dirancang untuk perusahaan retail kecil dengan ±10 karyawan. Sistem ini menggabungkan seluruh operasional bisnis dalam satu platform terpusat dengan biaya infrastruktur minimal.

**Modul Utama:**
- Point of Sale (POS)
- Warehouse Management
- Inventory Tracking
- Marketplace Integration (Shopee, TikTok Shop)
- Finance & Accounting (Double-Entry)
- Payroll
- Business Analytics

## 1.2 Tujuan Utama

Menyediakan satu sistem terpusat untuk seluruh operasional bisnis retail dengan:
- Biaya infrastruktur rendah (maks Rp500.000/bulan)
- Performa stabil untuk 10–20 pengguna aktif
- Zero inventory discrepancy melalui audit trail lengkap
- Otomasi pemrosesan order marketplace
- Laporan keuangan real-time

---

# 2. Deployment Strategy (Ultra Lean Infrastructure)

## 2.1 Target Biaya

> ✔ **Budget maksimal server: Rp500.000/bulan. Target realistis dengan optimalisasi: ±Rp292.000/bulan.**

## 2.2 Infrastruktur

Sistem menggunakan arsitektur **monolith** yang berjalan dalam satu VPS untuk meminimalkan biaya operasional. Seluruh service dijalankan menggunakan **Docker Compose**.

| Komponen | Detail |
|---|---|
| Runtime | Node.js (Express.js + TypeScript) |
| Database | PostgreSQL + PgBouncer (connection pooling) |
| Cache & Queue | Redis (digunakan juga untuk BullMQ job queue) |
| Reverse Proxy | Nginx + Let's Encrypt SSL (gratis) |
| File Storage | Local server storage |
| Monitoring | UptimeRobot (external) + Netdata (internal, self-hosted) |
| Container | Docker Compose |
| Log Management | Winston + Docker log rotation |

## 2.3 Arsitektur Sistem

```
Internet → Nginx (HTTPS, Let's Encrypt) → Node.js API → PostgreSQL (via PgBouncer) → Redis
Node.js API → BullMQ (Redis) → Background Workers (marketplace sync, reports, notifications)
```

## 2.4 Estimasi Biaya Detail

| Item | Estimasi/Bulan | Keterangan |
|---|---|---|
| VPS 4vCPU / 8GB RAM (Hetzner CX32) | Rp280.000 | Primary |
| Domain .com | Rp12.000 | Wajib |
| SSL Certificate | Rp0 | Let's Encrypt |
| Backup Storage (Backblaze B2, s/d 10GB) | Rp0 | Free tier |
| Monitoring (UptimeRobot + Netdata) | Rp0 | Free / Self-hosted |
| **TOTAL ESTIMASI** | **±Rp292.000** | **Headroom Rp208.000** |

> ℹ Sisa headroom ±Rp208.000/bulan dapat digunakan sebagai buffer upgrade storage atau snapshot VPS jika dibutuhkan.

---

# 3. Target Users & Role

| Role | Akses Utama | Batasan |
|---|---|---|
| Owner | Full access semua modul + analytics | — |
| Finance | Finance, payroll, laporan keuangan | Tidak bisa edit stok langsung |
| Warehouse Staff | Inventory, warehouse, procurement receive | Tidak bisa akses keuangan |
| Cashier | POS saja (shift management) | Akses paling terbatas |
| Admin | User management, konfigurasi sistem | Tidak bisa delete data transaksi |

---

# 4. Core Business Modules

## 4.1 POS (Point of Sale)

> ✖ **KRITIKAL: POS harus mendukung Offline Mode. Jika internet mati, transaksi tetap berjalan dan disinkronkan saat koneksi pulih.**

Digunakan oleh kasir untuk transaksi toko fisik.

**Fitur:**
- Scan barcode produk
- Cart management (tambah, kurang, hapus item)
- Multi-payment support (tunai, transfer, QRIS)
- Receipt generation (cetak / digital)
- Shift management (open/close shift dengan rekap)
- **OFFLINE MODE:** IndexedDB untuk antrian transaksi lokal
- Auto-sync ke server saat koneksi internet pulih

**Alur Transaksi:**
1. Login & Open Shift
2. Scan produk / cari manual
3. Add to Cart
4. Pilih metode pembayaran
5. Complete Transaction
6. Generate Receipt (print/digital)

**Output Setiap Transaksi:**
- Transaction record tersimpan di database
- Inventory movement record (`SALE`)
- Journal entry akuntansi (Debit Cash / Credit Revenue)

> ℹ POS Interface dibangun sebagai **PWA (Progressive Web App)** dengan Service Worker untuk mendukung offline mode dan caching aset.

---

## 4.2 Inventory Management

Inventory adalah **core system** dari ERP. Setiap perubahan stok wajib menghasilkan inventory movement record yang tidak dapat dihapus (append-only log).

**Tipe Movement:**

| Tipe | Keterangan |
|---|---|
| SALE | Stok keluar akibat penjualan POS atau marketplace |
| PURCHASE | Stok masuk dari penerimaan Purchase Order |
| TRANSFER | Perpindahan stok antar lokasi/gudang |
| RETURN | Stok masuk kembali dari retur pelanggan |
| ADJUSTMENT | Koreksi stok manual (wajib ada alasan & approver) |

**Fitur Tambahan:**
- Real-time stock tracking dengan Redis cache
- Stock reservation untuk order yang sudah confirmed tapi belum dikirim
- Low stock alert otomatis via notifikasi
- Inventory movement log bersifat append-only (tidak bisa dihapus)

---

## 4.3 Warehouse Management

Gudang menggunakan model lokasi bertingkat untuk tracking lokasi fisik barang.

**Hierarki Lokasi:**
```
Warehouse → Zone → Rack → Bin
```

**Fitur:**
- Receive goods dari Purchase Order
- Assign lokasi fisik saat barang masuk
- Picking list untuk persiapan pengiriman
- Packing workflow sebelum barang keluar

---

## 4.4 Procurement

Mengelola seluruh proses pembelian dari supplier hingga barang masuk gudang.

**Alur:**
1. Create Purchase Order
2. Approval (oleh Owner/Admin)
3. Kirim ke supplier
4. Receive goods (update inventory otomatis)
5. Verifikasi & closing PO

---

## 4.5 Marketplace Integration

> ⚠ **CATATAN PENTING: Sinkronisasi stok dan import order ke marketplace berjalan sebagai BACKGROUND JOB (BullMQ) agar tidak memblok API utama.**

**Platform yang Diintegrasikan:**
- Shopee
- TikTok Shop

**Fitur:**
- Order import otomatis dari marketplace
- Inventory sync dua arah (stok di ERP sync ke marketplace)
- Shipment tracking update
- Webhook handler untuk event marketplace

**Contoh Events:**
```
order.created    →  import ke sistem, kurangi stok (reservation)
order.cancelled  →  kembalikan stok reservation
order.shipped    →  update status pengiriman
```

---

## 4.6 Finance & Accounting

Sistem keuangan menggunakan **double-entry accounting**. Setiap transaksi bisnis secara otomatis menghasilkan journal entry.

**Contoh Journal Entry Otomatis:**

| Sumber Transaksi | Debit | Credit |
|---|---|---|
| Penjualan POS (Tunai) | Cash | Revenue |
| Penjualan Marketplace | Accounts Receivable | Revenue |
| Pembelian (Purchase Order) | Inventory | Accounts Payable |
| Pembayaran ke Supplier | Accounts Payable | Cash |
| Penggajian | Salary Expense | Cash |

**Laporan Keuangan:**
- Profit & Loss (Laba Rugi)
- Balance Sheet (Neraca)
- Cash Flow Statement
- Laporan per periode, per produk, per channel

---

## 4.7 Payroll

- Kalkulasi gaji pokok
- Bonus & tunjangan
- Potongan (BPJS, pinjaman, dll.)
- Kalkulasi pajak PPh 21
- Export slip gaji

---

## 4.8 Business Analytics

- Dashboard KPI real-time (revenue, margin, stok)
- Sales trend per produk / per channel
- Laporan performa marketplace
- Generate laporan besar berjalan sebagai background job (BullMQ)

---

# 5. System Architecture

## 5.1 Application Layer

| Layer | Detail |
|---|---|
| Frontend Admin | Next.js (Admin Dashboard) |
| Frontend POS | Next.js PWA + Service Worker (Offline Support) |
| Backend API | Node.js + Express.js + TypeScript |
| ORM | Drizzle ORM |
| Job Queue | BullMQ (berbasis Redis — tanpa service baru) |
| API Prefix | `/api/v1/` (versioned dari awal) |

## 5.2 Data Layer

| Komponen | Detail |
|---|---|
| Database | PostgreSQL |
| Connection Pooling | PgBouncer (mode: transaction, max_client_conn: 100) |
| Cache | Redis |
| Job Queue Storage | Redis (BullMQ) |
| POS Offline Storage | IndexedDB (browser) |
| File Storage | Local server storage |

## 5.3 Networking & Security

| Komponen | Detail |
|---|---|
| Reverse Proxy | Nginx |
| SSL | Let's Encrypt (Certbot, auto-renewal) |
| Enkripsi | HTTPS end-to-end |
| Password | Hashing (bcrypt) |
| Access Control | RBAC (Role-Based Access Control) |
| Firewall | UFW (hanya port 80, 443, 22 yang open) |
| DB Access | Restricted ke internal network, tidak expose ke public |
| Netdata | Accessible via internal network / VPN saja |

---

# 6. Database Schema

## 6.1 Core Tables

| Table | Deskripsi |
|---|---|
| `users`, `roles`, `permissions` | Autentikasi dan RBAC |
| `stores`, `warehouses`, `locations` | Master data lokasi bisnis |
| `products`, `product_variants` | Master data produk & varian |
| `inventory`, `inventory_movements` | Stok real-time & log pergerakan stok |
| `transactions`, `transaction_items` | Transaksi POS |
| `orders`, `order_items` | Order marketplace |
| `suppliers`, `purchase_orders`, `purchase_order_items` | Data pengadaan |
| `accounts`, `journal_entries`, `journal_entry_items` | Akuntansi double-entry |
| `payroll` | Data penggajian karyawan |
| `audit_logs` | Log semua perubahan data penting |

## 6.2 Audit Log — Skema Detail

> ⚠ **CATATAN PENTING: Tabel `audit_logs` wajib mencakup kolom berikut untuk memastikan setiap selisih stok atau keuangan dapat ditelusuri.**

| Kolom | Tipe Data | Keterangan |
|---|---|---|
| `user_id` | UUID (FK) | Siapa yang melakukan aksi |
| `action` | ENUM | CREATE / UPDATE / DELETE |
| `table_name` | VARCHAR | Tabel yang dimodifikasi |
| `record_id` | UUID | ID record yang dimodifikasi |
| `old_value` | JSONB | Snapshot data sebelum perubahan |
| `new_value` | JSONB | Snapshot data sesudah perubahan |
| `ip_address` | INET | IP address client |
| `created_at` | TIMESTAMPTZ | Timestamp aksi (UTC) |

---

# 7. Tech Stack

| Kategori | Teknologi | Keterangan |
|---|---|---|
| Backend Runtime | Node.js + Express.js | TypeScript |
| ORM | Drizzle ORM | Type-safe, ringan |
| Frontend | Next.js | Admin dashboard + POS PWA |
| Database | PostgreSQL | Primary data store |
| DB Pooling | PgBouncer | Cegah connection exhaustion |
| Cache | Redis | Caching + BullMQ storage |
| Job Queue | BullMQ | Async jobs, no extra service |
| Logger | Winston | Daily rotate + structured log |
| Container | Docker + Docker Compose | Single-node deployment |
| Proxy | Nginx + Certbot | HTTPS, routing, SSL auto-renew |
| Monitoring | UptimeRobot + Netdata | External uptime + internal metrics |
| Offline Storage | IndexedDB | POS offline transactions |

---

# 8. Infrastructure Specification

## 8.1 VPS Specification

| Spesifikasi | Nilai |
|---|---|
| vCPU | 4 core |
| RAM | 8 GB |
| Storage | 80 GB SSD |
| OS | Ubuntu 22.04 LTS |
| Provider Rekomendasi | Hetzner CX32 / DigitalOcean / Contabo |
| Estimasi Biaya | ±Rp280.000/bulan (Hetzner) |

## 8.2 Docker Compose — Konfigurasi Kritis

### Log Rotation (wajib pada semua services)

> ✖ **KRITIKAL: Tanpa log rotation, log Docker dapat menghabiskan disk 80GB dalam beberapa bulan.**

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "5"
```

### PgBouncer (Connection Pooling)

```yaml
pgbouncer:
  image: edoburu/pgbouncer
  environment:
    DB_HOST: postgres
    POOL_MODE: transaction
    MAX_CLIENT_CONN: 100
```

### Netdata (Self-hosted Monitoring)

```yaml
netdata:
  image: netdata/netdata
  ports: ["127.0.0.1:19999:19999"]  # Bind ke localhost saja
  # Akses via SSH tunnel atau VPN, JANGAN expose ke public
```

---

# 9. Backup Strategy

> ✖ **KRITIKAL: Backup yang tidak dienkripsi berbahaya jika storage eksternal bocor. Selalu enkripsi backup sebelum dikirim ke external storage.**

| Parameter | Nilai |
|---|---|
| Metode | pg_dump + gzip + enkripsi GPG |
| Jadwal | Setiap malam (cron job otomatis) |
| Enkripsi | GPG symmetric atau asymmetric (email owner) |
| Storage | Backblaze B2 (free tier s/d 10GB) |
| Retention Policy | Simpan 7 hari terakhir, hapus yang lebih lama otomatis |
| Verifikasi | Test restore minimal 1x sebulan |

### Script Backup (Contoh)

```bash
#!/bin/bash
pg_dump $DB_URL \
  | gzip \
  | gpg --encrypt -r owner@email.com \
  > backup_$(date +%F).sql.gz.gpg

# Hapus backup > 7 hari
find /backups -name "*.gpg" -mtime +7 -delete
```

---

# 10. Monitoring

| Tool | Tipe | Fungsi |
|---|---|---|
| UptimeRobot | External | Ping monitoring, alert jika server down |
| Netdata | Internal (self-hosted) | CPU, RAM, Disk, Network real-time |
| Winston | Application | Structured logs dengan daily rotation |
| BullMQ Dashboard | Internal | Monitor status background jobs |

> ⚠ Akses Netdata dashboard hanya melalui SSH tunnel atau VPN internal. Jangan pernah expose port `19999` ke public internet.

---

# 11. Security

| Aspek | Implementasi |
|---|---|
| Transport | HTTPS (Let's Encrypt, auto-renew) |
| Password Storage | Bcrypt hashing (cost factor ≥ 12) |
| Authentication | JWT dengan expiry + refresh token |
| Authorization | RBAC (Role-Based Access Control) |
| Firewall | UFW: hanya port 22, 80, 443 yang open |
| Database | Tidak expose ke public, akses via internal network |
| Backup | Dienkripsi GPG sebelum dikirim ke external storage |
| Monitoring | Netdata hanya accessible via internal network/VPN |
| Rate Limiting | Nginx rate limit pada endpoint login & API public |
| Audit Trail | Semua perubahan data tercatat di `audit_logs` |

---

# 12. Development Plan

> ⚠ **API versioning `/api/v1/` WAJIB diterapkan sejak Phase 0.**

| Phase | Nama | Deliverable |
|---|---|---|
| Phase 0 | Infrastruktur | VPS setup, Docker Compose, Nginx, SSL (Let's Encrypt), CI/CD pipeline (GitHub Actions → deploy via SSH), PgBouncer, Netdata, log rotation |
| Phase 1 | Auth & RBAC | Authentication, user management, RBAC, API versioning `/api/v1/` |
| Phase 2 | Product & Inventory | Product catalog, inventory system, audit log |
| Phase 3 | POS | POS transaction, offline mode (PWA + IndexedDB), auto-sync |
| Phase 4 | Warehouse | Warehouse management, picking, packing |
| Phase 5 | Procurement | Purchase order, approval workflow, goods receipt |
| Phase 6 | Marketplace | Shopee & TikTok Shop integration, BullMQ async jobs, webhook handler |
| Phase 7 | Finance | Double-entry accounting, journal entries, laporan keuangan |
| Phase 8 | Payroll | Salary calculation, deductions, tax, slip gaji |
| Phase 9 | Analytics | Dashboard KPI, background job untuk laporan besar |

> ✔ **Setiap Phase wajib disertai integration test minimal untuk flow utama.** Contoh: Phase 3 harus memastikan transaksi POS menghasilkan `inventory_movement` dan `journal_entry` yang benar secara otomatis.

---

# 13. Success Metrics

| Metrik | Target |
|---|---|
| Inventory discrepancy | Mendekati 0% (audit trail penuh) |
| Marketplace order processing | Otomatis 100% tanpa intervensi manual |
| Waktu generate laporan keuangan | < 5 detik (laporan standar) |
| Stabilitas sistem (10–20 user aktif) | Uptime ≥ 99.5%/bulan |
| POS offline recovery | Semua transaksi offline tersinkronisasi saat reconnect |
| Biaya infrastruktur | ≤ Rp500.000/bulan |
| Response time API | < 500ms untuk 95% request |

---

# 14. Future Scaling Plan

Jika bisnis berkembang dan kebutuhan melebihi kapasitas single VPS, lakukan eskalasi bertahap:

| Tahap | Aksi | Trigger |
|---|---|---|
| Scaling 1 | Upgrade VPS ke spec lebih besar | CPU/RAM usage > 80% sustained |
| Scaling 2 | Pindah PostgreSQL ke managed database (Supabase/Neon) | DB menjadi bottleneck |
| Scaling 3 | Tambah CDN untuk aset statik | Traffic meningkat signifikan |
| Scaling 4 | Tambah read replica PostgreSQL | Query analytics memberatkan DB |
| Scaling 5 | Pisah ke microservices | Tim berkembang & modul independen |

> ℹ Arsitektur monolith saat ini sudah dirancang agar dapat diextract menjadi microservices secara bertahap. Gunakan **domain-driven boundaries** dari awal (setiap modul berdiri sendiri secara logika).

---

# Appendix A: Ringkasan Optimalisasi (v2.0 → v2.1)

| # | Optimalisasi | Dampak |
|---|---|---|
| 1 | BullMQ untuk async job queue | Marketplace sync & laporan tidak memblok API |
| 2 | PgBouncer connection pooling | Cegah DB exhaustion saat load tinggi |
| 3 | POS Offline Mode (PWA + IndexedDB) | Kasir tetap bisa transaksi jika internet mati |
| 4 | Netdata self-hosted monitoring | Visibility CPU/RAM/Disk tanpa biaya tambahan |
| 5 | Let's Encrypt SSL otomatis | HTTPS gratis, auto-renew, tidak perlu beli SSL |
| 6 | Docker log rotation | Cegah disk habis akibat log yang tidak dibersihkan |
| 7 | Audit log skema diperkuat | Investigasi selisih stok/keuangan lebih mudah |
| 8 | API versioning `/api/v1/` | Future-proof untuk integrasi baru |
| 9 | Backup enkripsi GPG + retention 7 hari | Keamanan data & manajemen storage otomatis |
| 10 | Phase 0 infrastruktur ditambahkan | Fondasi CI/CD dan setup server sebelum coding |
| 11 | Integration test per phase | Minimalisasi bug di setiap milestone |
| 12 | Estimasi biaya detail (Rp292.000) | Transparansi biaya, headroom Rp208.000 |
