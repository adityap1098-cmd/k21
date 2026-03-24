-- Add foreign key constraint: transaction_items.variant_id → product_variants.id
-- Ensures referential integrity — no transaction item can reference a non-existent variant
ALTER TABLE "transaction_items"
  ADD CONSTRAINT "transaction_items_variant_id_product_variants_id_fk"
  FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id");

-- Add index on variant_id for faster joins and FK lookups
CREATE INDEX IF NOT EXISTS "idx_transaction_items_variant_id"
  ON "transaction_items" ("variant_id");

-- Also add missing index on transaction_id (used in every query)
CREATE INDEX IF NOT EXISTS "idx_transaction_items_transaction_id"
  ON "transaction_items" ("transaction_id");
