-- H-33: Prevent duplicate OPEN shifts per cashier via partial unique index (TOCTOU race fix)
-- H-34: Deadlock prevention is handled in application code by sorting variant IDs
-- C-12: Add critical missing indexes for performance

-- Shift open race condition fix
CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_one_open_per_cashier
  ON shifts (cashier_id) WHERE status = 'OPEN';

-- C-12: Missing indexes on transactions
CREATE INDEX IF NOT EXISTS idx_transactions_shift_id ON transactions (shift_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions (status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_cashier_id ON transactions (cashier_id);

-- transaction_payments
CREATE INDEX IF NOT EXISTS idx_transaction_payments_transaction_id ON transaction_payments (transaction_id);

-- shifts
CREATE INDEX IF NOT EXISTS idx_shifts_cashier_status ON shifts (cashier_id, status);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, read_at);

-- product_variants
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants (product_id);

-- journal_entries
CREATE INDEX IF NOT EXISTS idx_journal_entries_created_at ON journal_entries (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_entries_source_type ON journal_entries (source_type);

-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);

-- stock_movements
CREATE INDEX IF NOT EXISTS idx_stock_movements_variant_id ON stock_movements (variant_id);

-- service_orders
CREATE INDEX IF NOT EXISTS idx_service_orders_created_at ON service_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_orders_vehicle_id ON service_orders (vehicle_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_mechanic_id ON service_orders (mechanic_id);

-- service_order_items
CREATE INDEX IF NOT EXISTS idx_service_order_items_order_id ON service_order_items (service_order_id);

-- transaction_returns
CREATE INDEX IF NOT EXISTS idx_transaction_returns_transaction_id ON transaction_returns (transaction_id);

-- marketplace tables
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_channel_id ON marketplace_orders (channel_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status ON marketplace_orders (status);
