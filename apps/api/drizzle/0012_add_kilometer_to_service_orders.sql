-- Add kilometer column to service_orders
ALTER TABLE service_orders ADD COLUMN IF NOT EXISTS kilometer INTEGER;
