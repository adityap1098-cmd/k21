---
name: deep-research
description: >
  Metodologi riset mendalam untuk semua task analisis, audit, investigasi, dan brainstorming pada codebase.
  Gunakan skill ini setiap kali diminta untuk: audit coverage backend vs frontend, analisis gap fitur,
  debugging kompleks, research struktur kode, brainstorming solusi, investigasi bug, cek apakah sesuatu
  "sudah terimplementasi" atau "sudah tersambung". Intinya: kapanpun butuh menjawab pertanyaan tentang
  kondisi aktual codebase — bukan asumsi, tapi fakta dari membaca file.
---

# Deep Research Methodology

Skill ini memastikan setiap analisis berbasis **bukti dari file yang dibaca**, bukan asumsi atau inferensi permukaan. Tujuan utama: menghasilkan output yang setara dengan yang dihasilkan tool riset profesional seperti GSD.

---

## Prinsip Utama

**Jangan pernah menyimpulkan dari luar ke dalam.** Artinya: jangan bilang "kemungkinan sudah tersambung karena halamannya ada" — buka file-nya, baca kodenya, buktikan. Perbedaan antara audit dangkal dan audit akurat adalah satu langkah: membaca isi file sampai ke detail implementasi.

**Hitung secara eksak, bukan label.** "2/7 endpoints diimplementasi" lebih berguna dari "partial". Kalau kamu tidak tahu angka pastinya, baca sampai tahu.

**Bedakan antara "ada" dan "berfungsi".** Sebuah tombol bisa ada di UI tapi memanggil endpoint yang salah. Sebuah endpoint bisa ada di router tapi return hardcoded data. Selalu verifikasi lapisan implementasi, bukan hanya keberadaan.

---

## Workflow Riset

### Langkah 1 — Inventory dulu, simpulkan nanti

Sebelum menulis satu kalimat analisis, buat daftar lengkap semua entitas yang relevan:

- Untuk audit backend: `grep -n "Router\.(get|post|put|patch|delete)(" <file>` di setiap router
- Untuk audit frontend: `find src/app -name "page.tsx"` + list semua components yang relevan
- Untuk debugging: list semua file yang mungkin terlibat sebelum membuka satu pun

Hitung total: berapa endpoint, berapa halaman, berapa komponen.

### Langkah 2 — Baca secara berlapis (inside-out)

Untuk setiap entitas, baca **dari dalam ke luar**:

**Layer 1 — Implementasi aktual (paling dalam):**
- Backend service: apakah query ke database sungguhan, atau return hardcoded?
- Frontend handler: apakah data yang dikirim cocok field-by-field dengan yang diharapkan?

**Layer 2 — Kontrak/Interface:**
- Backend schema validation (Zod, Joi, dll): field apa yang wajib? tipe apa?
- Frontend form/API call: field apa yang dikirim?
- Cross-check: `field_di_frontend ↔ field_di_backend_schema`

**Layer 3 — Keberadaan (paling luar):**
- Apakah route terdaftar?
- Apakah halaman ada?
- Apakah ada nav link ke halaman itu?

**Urutan penting:** baca Layer 1 dulu. Banyak bug tersembunyi di sana.

### Langkah 3 — Cross-reference eksplisit

Untuk setiap koneksi yang diklaim (misalnya "halaman procurement memanggil API create PO"), lakukan verifikasi eksplisit:

```
Frontend mengirim:  { product: string, qty: number, unitPrice: number }
Backend expects:    { variantId: UUID, variantSku: string, unitCost: number }
Status:             ❌ MISMATCH — akan gagal 400 Bad Request
```

Jangan skip langkah ini. Ini sumber utama false-positive dalam audit dangkal.

### Langkah 4 — Format output terstruktur

Setelah data terkumpul, sajikan dengan format yang konsisten:

**Untuk audit coverage:**
```
| # | Module | Endpoints | Coverage | Status | Gap Spesifik |
|---|--------|-----------|----------|--------|--------------|
| 1 | auth   | 4 total   | 4/4      | ✅ Full | —            |
| 2 | proc.  | 7 total   | 2/7      | 🔴 Gap | Submit, approve, cancel, receive tidak ada UI. Form create salah schema |
```

Status legend yang digunakan secara konsisten:
- ✅ Full — semua endpoint dipanggil, semua payload cocok
- ⚠️ Partial — sebagian endpoint dipanggil atau ada minor mismatch
- 🔴 Missing/Gap — halaman tidak ada atau endpoint tidak pernah dipanggil
- 🟡 Stub — implementasi backend return hardcoded/mock data

**Untuk brainstorming/analisis:**
- Pisahkan fakta (dari file yang dibaca) vs inferensi (logika dari fakta)
- Label inferensi secara eksplisit: "Berdasarkan pola X, kemungkinan Y"
- Berikan confidence level kalau relevan

### Langkah 5 — Gap analysis dengan dampak

Setiap gap yang ditemukan harus disertai:
1. **Apa yang hilang** — spesifik (nama endpoint, nama field, baris kode)
2. **Dampak aktual** — apakah ini broken (error), degraded (fitur tidak muncul), atau cosmetic?
3. **Prioritas** — berdasarkan dampak ke operasional harian, bukan kompleksitas teknis

---

## Anti-patterns yang HARUS dihindari

### ❌ Surface-level check
```
"Halaman procurement ada, ada import apiGet → ✅ Full"
```
Ini salah. Harus baca apa yang dikirim form, bukan hanya bahwa ada API call.

### ❌ Vague status
```
"Sebagian fitur sudah diimplementasi"
```
Ini tidak berguna. Ganti dengan: "3 dari 7 endpoint diimplementasi. Missing: submit, approve, cancel."

### ❌ Assumption cascade
```
"Backend ada, frontend ada, jadi pasti tersambung"
```
Backend ada + frontend ada ≠ tersambung dengan benar. Verifikasi eksplisit wajib.

### ❌ Stop di router
```
grep endpoints di router → selesai
```
Baca juga service implementation. Router bisa forward ke service yang return hardcoded data.

---

## Checklist Sebelum Menyimpulkan

Sebelum menulis kesimpulan apapun, pastikan sudah:

- [ ] Membaca router file untuk semua endpoint (bukan hanya module yang obvious)
- [ ] Membaca form submit handler di frontend (bukan hanya URL yang dipanggil)
- [ ] Membandingkan field names antara frontend payload dan backend Zod/validation schema
- [ ] Membaca service implementation untuk cek stub/hardcoded
- [ ] Menghitung coverage secara eksak (X/Y), bukan hanya "partial"
- [ ] Setiap gap punya dampak yang dijelaskan (broken/degraded/cosmetic)

---

## Contoh: Cara Riset yang Benar vs Salah

### Task: "Apakah halaman procurement sudah tersambung ke backend?"

**❌ Cara salah (dangkal):**
1. Cek `apps/web/src/app/procurement/page.tsx` — ada? ✓
2. Cek `apps/api/src/modules/procurement/` — ada? ✓
3. Cari `apiGet` di procurement page — ada? ✓
4. Kesimpulan: "✅ Procurement tersambung"

**✅ Cara benar (mendalam):**
1. Baca `procurement.router.ts` → list 7 endpoints: create, submit, approve, cancel, receive, get, list
2. Baca `procurement/page.tsx` seluruhnya:
   - `apiGet('/api/v1/procurement/purchase-orders')` → list ✓
   - Form submit: `{ product: string, qty: number, unitPrice: number }` ← baca ini
3. Baca `procurement.router.ts` Zod schema:
   - Expects: `{ variantId: UUID, variantSku: string, unitCost: number }` ← baca ini
4. Cross-check: `product` ≠ `variantId` → **MISMATCH** → create PO akan 400 Bad Request
5. Cek endpoint submit, approve, cancel, receive → tidak ada di frontend
6. Kesimpulan: "🔴 2/7 endpoints. Create PO broken (schema mismatch). Submit/approve/cancel/receive tidak ada UI."

---

## Kapan Skill Ini Berlaku

Aktifkan metodologi ini setiap kali menerima perintah seperti:
- "audit [X]" / "cek apakah sudah terimplementasi"
- "apa yang belum dibuat" / "apa yang missing"
- "kenapa [fitur] tidak berfungsi" (investigasi)
- "research [topik] di codebase ini"
- "bandingkan [A] dengan [B]"
- "apakah [frontend/backend] sudah tersambung"
- Semua pertanyaan yang jawabannya membutuhkan membaca file, bukan hanya mengingat

Intinya: **kalau kamu perlu membuka file untuk menjawab dengan benar, gunakan metodologi ini.**
