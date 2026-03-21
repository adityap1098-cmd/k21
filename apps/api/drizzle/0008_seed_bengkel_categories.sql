-- 0008: Seed bengkel motor categories
-- Idempotent: only inserts if name does not exist

DO $$
BEGIN
  -- Add unique constraint on name if not exists (for idempotent seeding)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_name_unique'
  ) THEN
    ALTER TABLE categories ADD CONSTRAINT categories_name_unique UNIQUE (name);
  END IF;
END $$;

INSERT INTO categories (id, name, parent_id, created_at, updated_at) VALUES
  (gen_random_uuid(), 'Mesin', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Suspensi', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Pengereman', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Kelistrikan', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Body & Eksterior', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Ban & Velg', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Transmisi & Kopling', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Sistem Bahan Bakar', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Knalpot & Exhaust', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Bearing & Seal', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Filter', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Oli & Cairan', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Rantai & Gear', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Lampu & Bohlam', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Kabel & Selang', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Busi & Pengapian', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Aksesoris Motor', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Helm & Safety Gear', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Perkakas & Tools', NULL, NOW(), NOW()),
  (gen_random_uuid(), 'Jasa Service', NULL, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;
