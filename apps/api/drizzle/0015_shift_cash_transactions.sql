-- 0015: Add shift_cash_transactions table for cash in/out during shifts
-- Tracks pengeluaran (expenses) and pemasukan (income) outside of POS sales

CREATE TYPE cash_transaction_type AS ENUM ('IN', 'OUT');

CREATE TABLE shift_cash_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id    UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  type        cash_transaction_type NOT NULL,
  amount      INTEGER NOT NULL CHECK (amount > 0),
  description VARCHAR(255) NOT NULL,
  created_by  UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_shift_cash_tx_shift ON shift_cash_transactions(shift_id);
