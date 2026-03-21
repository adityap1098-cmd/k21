-- Migration: service_order_items
-- Adds item_type enum and service_order_items table for BKL-10 (line items) & BKL-11 (hybrid pricing)

CREATE TYPE "item_type" AS ENUM ('SERVICE', 'PART');

CREATE TABLE "service_order_items" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "service_order_id"  UUID NOT NULL REFERENCES "service_orders"("id"),
  "item_type"         "item_type" NOT NULL,
  "catalog_item_id"   UUID,
  "variant_id"        UUID,
  "description"       VARCHAR(255) NOT NULL,
  "qty"               INTEGER NOT NULL,
  "unit_price"        INTEGER NOT NULL,
  "line_total"        INTEGER NOT NULL
);

CREATE INDEX "idx_service_order_items_order_id" ON "service_order_items" ("service_order_id");
