/**
 * Update all product variant stock to 1000
 * Usage: node update-stock-1000.mjs
 */

import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL || 'postgres://appuser:k21devpass@localhost:5433/k21')

async function run() {
  const before = await sql`SELECT COUNT(*) AS total FROM product_variants`
  console.log(`Total varian produk: ${before[0].total}`)

  const result = await sql`
    UPDATE product_variants SET stock_qty = 1000, updated_at = NOW()
  `

  console.log(`✅ Semua stok produk berhasil diupdate ke 1000`)

  await sql.end()
}

run().catch(err => {
  console.error('Gagal:', err)
  process.exit(1)
})
