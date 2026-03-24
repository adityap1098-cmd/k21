-- Create mechanics table
CREATE TABLE IF NOT EXISTS mechanics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  phone       VARCHAR(30),
  specialty   VARCHAR(255),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migrate existing mechanic names from service_orders into mechanics table
INSERT INTO mechanics (name)
SELECT DISTINCT INITCAP(TRIM(mechanic_id))
FROM service_orders
WHERE mechanic_id IS NOT NULL AND TRIM(mechanic_id) <> ''
ON CONFLICT DO NOTHING;

-- Add index for quick lookup
CREATE INDEX IF NOT EXISTS idx_mechanics_name ON mechanics (name);
CREATE INDEX IF NOT EXISTS idx_mechanics_active ON mechanics (is_active) WHERE is_active = true;
