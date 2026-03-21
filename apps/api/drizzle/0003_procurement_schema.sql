-- Migration: 0003 Procurement Schema
-- Tables: purchase_orders, purchase_order_items, goods_receipts

DO $$ BEGIN
  CREATE TYPE po_status AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number      VARCHAR(50) NOT NULL UNIQUE,
  supplier_id    UUID,
  supplier_name  VARCHAR(255) NOT NULL,
  status         po_status NOT NULL DEFAULT 'DRAFT',
  notes          VARCHAR(2000),
  subtotal       NUMERIC(15, 2) NOT NULL,
  tax_amount     NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total          NUMERIC(15, 2) NOT NULL,
  created_by     UUID NOT NULL,
  approved_by    UUID,
  approved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  variant_id        UUID NOT NULL,
  variant_sku       VARCHAR(100) NOT NULL,
  variant_name      VARCHAR(255) NOT NULL,
  qty               INTEGER NOT NULL,
  unit_cost         NUMERIC(15, 2) NOT NULL,
  line_total        NUMERIC(15, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS goods_receipts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
  item_id           UUID NOT NULL REFERENCES purchase_order_items(id),
  qty_received      INTEGER NOT NULL,
  received_by       UUID NOT NULL,
  received_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes             VARCHAR(500)
);
