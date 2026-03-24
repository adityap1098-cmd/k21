/**
 * Run migrations 0016 (transaction_returns) + 0017 (suppliers)
 * Usage: node run-migration-0016-0017.mjs
 */

import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL || 'postgres://appuser:k21devpass@localhost:5433/k21')

async function run() {
  // ── 0016: transaction_returns ──
  console.log('Running migration 0016_transaction_returns...')

  const returnsExists = await sql`
    SELECT 1 FROM information_schema.tables WHERE table_name = 'transaction_returns'
  `

  if (returnsExists.length === 0) {
    await sql`
      CREATE TABLE transaction_returns (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id  UUID NOT NULL REFERENCES transactions(id),
        variant_id      UUID NOT NULL REFERENCES product_variants(id),
        qty             INTEGER NOT NULL CHECK (qty > 0),
        refund_amount   INTEGER NOT NULL CHECK (refund_amount >= 0),
        reason          VARCHAR(500) NOT NULL,
        performed_by    UUID NOT NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    console.log('✓ Created table: transaction_returns')

    await sql`CREATE INDEX idx_returns_tx ON transaction_returns(transaction_id)`
    console.log('✓ Created index: idx_returns_tx')
  } else {
    console.log('⏭ Table transaction_returns already exists, skipping')
  }

  // ── 0017: suppliers ──
  console.log('\nRunning migration 0017_suppliers...')

  const suppliersExists = await sql`
    SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers'
  `

  if (suppliersExists.length === 0) {
    await sql`
      CREATE TABLE suppliers (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name        VARCHAR(255) NOT NULL,
        contact     VARCHAR(255),
        phone       VARCHAR(50),
        email       VARCHAR(255),
        address     TEXT,
        notes       TEXT,
        active      BOOLEAN NOT NULL DEFAULT true,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    console.log('✓ Created table: suppliers')
  } else {
    console.log('⏭ Table suppliers already exists, skipping')
  }

  console.log('\n✅ Migrations 0016 + 0017 complete!')
  await sql.end()
}

run().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
