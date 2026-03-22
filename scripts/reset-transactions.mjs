/**
 * reset-transactions.mjs
 * Hapus semua data transaksi, shift, dan riwayat kas.
 * SIMPAN: products, variants, stock_cache, customers, users,
 *         categories, suppliers, vehicles, service_catalog, mechanics, warehouses
 */

import postgres from 'postgres'

const DATABASE_URL = 'postgres://appuser:k21devpass@localhost:5433/k21'

const sql = postgres(DATABASE_URL)

async function main() {
  console.log('🔍  Mengecek koneksi database...')

  // Cek semua tabel yang akan dihapus
  const tables = await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `
  console.log('📋  Tabel di database:', tables.map(t => t.tablename).join(', '))

  console.log('\n🗑️   Memulai reset transaksi...\n')

  // Urutan penting: hapus child tables dulu sebelum parent
  const steps = [
    // Service orders
    { table: 'service_order_items',      label: 'Item service order' },
    { table: 'service_payments',         label: 'Pembayaran service order' },
    { table: 'service_orders',           label: 'Service orders' },

    // POS retail
    { table: 'transaction_items',        label: 'Item transaksi POS' },
    { table: 'transaction_payments',     label: 'Pembayaran transaksi POS' },
    { table: 'transactions',             label: 'Transaksi POS' },

    // Shift & kas
    { table: 'shift_cash_transactions',  label: 'Kas masuk/keluar shift' },
    { table: 'shifts',                   label: 'Shift history' },

    // Accounting journal entries
    { table: 'journal_entries',          label: 'Journal entries akuntansi' },

    // Notifications & audit
    { table: 'notifications',            label: 'Notifikasi' },
    { table: 'audit_logs',              label: 'Audit logs' },

    // Refresh tokens (bersih tapi users tetap ada)
    { table: 'refresh_tokens',           label: 'Refresh tokens' },
  ]

  for (const step of steps) {
    try {
      // Cek apakah tabel ada
      const exists = await sql`
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public' AND tablename = ${step.table}
        LIMIT 1
      `
      if (exists.length === 0) {
        console.log(`  ⏭️  ${step.label} (${step.table}) — tabel tidak ada, skip`)
        continue
      }

      const result = await sql`DELETE FROM ${sql(step.table)}`
      console.log(`  ✅  ${step.label} (${step.table}) — ${result.count} baris dihapus`)
    } catch (err) {
      console.error(`  ❌  Gagal hapus ${step.table}:`, err.message)
    }
  }

  // Reset sequence inventory movements jika ada
  try {
    const exists = await sql`
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'inventory_movements'
      LIMIT 1
    `
    if (exists.length > 0) {
      await sql`DELETE FROM inventory_movements WHERE reference_type IN ('SALE', 'SERVICE')`
      console.log(`  ✅  Inventory movements (sale/service) — dihapus`)
    }
  } catch (err) {
    console.error('  ❌  Gagal hapus inventory movements:', err.message)
  }

  console.log('\n📊  Verifikasi data yang DISIMPAN:')
  const verify = [
    'users', 'products', 'product_variants', 'stock_cache',
    'customers', 'categories', 'suppliers', 'vehicles',
    'service_catalog', 'mechanics', 'warehouses'
  ]
  for (const table of verify) {
    try {
      const count = await sql`
        SELECT COUNT(*) as n FROM ${sql(table)}
      `
      console.log(`  📦  ${table}: ${count[0].n} baris`)
    } catch {
      // tabel mungkin nama beda, skip
    }
  }

  console.log('\n✅  Reset selesai!')
  await sql.end()
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
