-- 0018: Marketplace schema + journal_entries FK fix
-- Part A: Fix journal_entries — drop hard FK, make transaction_id nullable, add source_id
-- Part B: Marketplace enums (all idempotent)
-- Part C: 5 marketplace tables
-- Part D: Seed data

-- ─────────────────────────────────────────────────────────────────────────────
-- PART A: Fix journal_entries
-- Marketplace orders are not POS transactions, so the hard FK to transactions is wrong.
-- Drop the FK constraint, make transaction_id nullable, add source_id for polymorphic ref.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "journal_entries"
  DROP CONSTRAINT IF EXISTS "journal_entries_transaction_id_fk";

ALTER TABLE "journal_entries"
  ALTER COLUMN "transaction_id" DROP NOT NULL;

ALTER TABLE "journal_entries"
  ADD COLUMN IF NOT EXISTS "source_id" UUID;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART B: Marketplace enums (all idempotent via DO $$ BEGIN ... EXCEPTION block)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "marketplace_platform" AS ENUM ('shopee', 'tiktok');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "marketplace_sync_direction" AS ENUM ('INBOUND_ONLY', 'BIDIRECTIONAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "marketplace_channel_status" AS ENUM ('ACTIVE', 'TOKEN_EXPIRED', 'DISCONNECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "marketplace_order_status" AS ENUM (
    'PENDING', 'CONFIRMED', 'READY_TO_SHIP', 'SHIPPED',
    'DELIVERED', 'CANCELLED', 'RETURNED', 'STOCK_CONFLICT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "marketplace_sku_resolution_status" AS ENUM ('RESOLVED', 'UNRESOLVED', 'PARTIAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "marketplace_webhook_processing_status" AS ENUM ('PENDING', 'PROCESSED', 'FAILED', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PART C: 5 marketplace tables
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. marketplace_channels — one row per connected shop
CREATE TABLE IF NOT EXISTS "marketplace_channels" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "platform"         "marketplace_platform" NOT NULL,
  "shop_name"        VARCHAR(255) NOT NULL,
  "sync_direction"   "marketplace_sync_direction" NOT NULL DEFAULT 'INBOUND_ONLY',
  "partner_id"       VARCHAR(100),
  "shop_id"          VARCHAR(100),
  "access_token"     TEXT,
  "refresh_token"    TEXT,
  "token_expires_at" TIMESTAMPTZ,
  "status"           "marketplace_channel_status" NOT NULL DEFAULT 'DISCONNECTED',
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. marketplace_orders — one row per inbound order
CREATE TABLE IF NOT EXISTS "marketplace_orders" (
  "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "channel_id"            UUID NOT NULL REFERENCES "marketplace_channels"("id"),
  "order_sn"              VARCHAR(100) NOT NULL UNIQUE,
  "platform"              "marketplace_platform" NOT NULL,
  "status"                "marketplace_order_status" NOT NULL,
  "buyer_name"            VARCHAR(255),
  "buyer_masked_phone"    VARCHAR(50),
  "total_amount"          NUMERIC(15, 2) NOT NULL,
  "escrow_amount"         NUMERIC(15, 2),
  "platform_fee_amount"   NUMERIC(15, 2),
  "seller_voucher_amount" NUMERIC(15, 2),
  "sku_resolution_status" "marketplace_sku_resolution_status" NOT NULL DEFAULT 'UNRESOLVED',
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- 3. marketplace_order_items — line items within an order
CREATE TABLE IF NOT EXISTS "marketplace_order_items" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id"        UUID NOT NULL REFERENCES "marketplace_orders"("id") ON DELETE CASCADE,
  "seller_sku"      VARCHAR(100),
  "shopee_item_id"  BIGINT,
  "shopee_model_id" BIGINT,
  "variant_id"      UUID,
  "item_name"       VARCHAR(500) NOT NULL,
  "qty"             INT NOT NULL,
  "unit_price"      NUMERIC(15, 2) NOT NULL,
  "line_total"      NUMERIC(15, 2) NOT NULL
);

-- 4. marketplace_sku_mappings — maps marketplace SKUs to internal product variants
CREATE TABLE IF NOT EXISTS "marketplace_sku_mappings" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "channel_id"      UUID NOT NULL REFERENCES "marketplace_channels"("id"),
  "variant_id"      UUID NOT NULL REFERENCES "product_variants"("id"),
  "seller_sku"      VARCHAR(100) NOT NULL,
  "shopee_item_id"  BIGINT,
  "shopee_model_id" BIGINT,
  "is_active"       BOOLEAN NOT NULL DEFAULT true,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("channel_id", "seller_sku")
);

-- 5. marketplace_webhook_events — raw webhook payloads for audit / reprocessing
CREATE TABLE IF NOT EXISTS "marketplace_webhook_events" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "channel_id"        UUID REFERENCES "marketplace_channels"("id"),
  "event_type"        VARCHAR(100) NOT NULL,
  "payload"           JSONB NOT NULL DEFAULT '{}',
  "processing_status" "marketplace_webhook_processing_status" NOT NULL DEFAULT 'PENDING',
  "error_message"     TEXT,
  "processed_at"      TIMESTAMPTZ,
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- PART D: Seed data
-- ─────────────────────────────────────────────────────────────────────────────

-- Seed: one Shopee channel (DISCONNECTED — tokens not yet configured)
INSERT INTO "marketplace_channels" (
  "id", "platform", "shop_name", "sync_direction", "status",
  "access_token", "refresh_token", "token_expires_at",
  "created_at", "updated_at"
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  'shopee'::marketplace_platform,
  'Teladan27 Motor',
  'INBOUND_ONLY'::marketplace_sync_direction,
  'DISCONNECTED'::marketplace_channel_status,
  NULL, NULL, NULL,
  NOW(), NOW()
) ON CONFLICT DO NOTHING;

-- Seed: one SKU mapping — only if a product_variant exists (avoids FK violation on fresh DB)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM product_variants LIMIT 1) THEN
    INSERT INTO "marketplace_sku_mappings" (
      "channel_id", "variant_id", "seller_sku", "is_active"
    )
    SELECT
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      id,
      'SAMPLE-SKU-001',
      true
    FROM product_variants
    LIMIT 1
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
