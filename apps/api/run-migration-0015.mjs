/**
 * Run migration 0015: shift_cash_transactions
 * Usage: node run-migration-0015.mjs
 */

import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL || 'postgres://appuser:k21devpass@localhost:5433/k21')

async function run() {
  console.log('Running migration 0015_shift_cash_transactions...')

  // Check if type already exists
  const typeExists = await sql`
    SELECT 1 FROM pg_type WHERE typname = 'cash_transaction_type'
  `

  if (typeExists.length === 0) {
    await sql`CREATE TYPE cash_transaction_type AS ENUM ('IN', 'OUT')`
    console.log('✓ Created enum: cash_transaction_type')
  } else {
    console.log('⏭ Enum cash_transaction_type already exists, skipping')
  }

  // Check if table already exists
  const tableExists = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'shift_cash_transactions'
  `

  if (tableExists.length === 0) {
    await sql`
      CREATE TABLE shift_cash_transactions (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        shift_id    UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        type        cash_transaction_type NOT NULL,
        amount      INTEGER NOT NULL CHECK (amount > 0),
        description VARCHAR(255) NOT NULL,
        created_by  UUID NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    console.log('✓ Created table: shift_cash_transactions')

    await sql`CREATE INDEX idx_shift_cash_tx_shift ON shift_cash_transactions(shift_id)`
    console.log('✓ Created index: idx_shift_cash_tx_shift')
  } else {
    console.log('⏭ Table shift_cash_transactions already exists, skipping')
  }

  console.log('\n✅ Migration 0015 complete!')
  await sql.end()
}

run().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
