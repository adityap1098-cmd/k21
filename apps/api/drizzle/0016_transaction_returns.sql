-- 0016: Add transaction_returns table for partial refunds
-- Tracks individual item returns without voiding the entire transaction

CREATE TABLE transaction_returns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID NOT NULL REFERENCES transactions(id),
  variant_id      UUID NOT NULL REFERENCES product_variants(id),
  qty             INTEGER NOT NULL CHECK (qty > 0),
  refund_amount   INTEGER NOT NULL CHECK (refund_amount >= 0),
  reason          VARCHAR(500) NOT NULL,
  performed_by    UUID NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_returns_tx ON transaction_returns(transaction_id);
