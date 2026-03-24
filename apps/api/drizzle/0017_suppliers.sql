-- 0017: Add suppliers table for procurement module

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
);

-- Backfill supplier_id FK constraint is not added yet —
-- existing POs have supplier_name text but no FK.
-- New POs will reference suppliers.id via supplier_id column.
