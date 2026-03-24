-- 0010: Add proper enums and FK constraint to journal_entries table
-- This migration adds type-safe enums for status, debit_credit, and source_type columns,
-- and adds a foreign key constraint from journal_entries.transaction_id to transactions.id.

-- Step 1: Create enum types (IF NOT EXISTS for safety)
DO $$ BEGIN
  CREATE TYPE "journal_entry_status" AS ENUM ('PENDING', 'POSTED', 'REVERSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "debit_credit" AS ENUM ('DR', 'CR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "journal_source_type" AS ENUM (
    'POS_SALE', 'VOID', 'SERVICE_COMPLETION', 'CASH_RECEIPT',
    'MARKETPLACE_SALE', 'PURCHASE', 'SUPPLIER_PAYMENT', 'PAYROLL', 'ADJUSTMENT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Step 2: Alter columns to use enum types
-- source_type: varchar → journal_source_type
ALTER TABLE "journal_entries"
  ALTER COLUMN "source_type" TYPE "journal_source_type" USING "source_type"::"journal_source_type";

-- status: varchar → journal_entry_status
ALTER TABLE "journal_entries"
  ALTER COLUMN "status" TYPE "journal_entry_status" USING "status"::"journal_entry_status";

-- debit_credit: varchar → debit_credit enum
ALTER TABLE "journal_entries"
  ALTER COLUMN "debit_credit" TYPE "debit_credit" USING "debit_credit"::"debit_credit";

-- Step 3: Ensure debit_credit is NOT NULL (may already be, but enforce)
ALTER TABLE "journal_entries"
  ALTER COLUMN "debit_credit" SET NOT NULL;

-- Step 4: Add FK constraint from transaction_id → transactions.id
ALTER TABLE "journal_entries"
  ADD CONSTRAINT "journal_entries_transaction_id_fk"
  FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id");

-- Step 5: Add index on transaction_id for FK lookup performance
CREATE INDEX IF NOT EXISTS "idx_journal_entries_transaction_id"
  ON "journal_entries" ("transaction_id");
