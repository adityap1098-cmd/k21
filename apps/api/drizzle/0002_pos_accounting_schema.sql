-- Phase 3: POS + Accounting schema
-- Enums
DO $$ BEGIN
 CREATE TYPE "shift_status" AS ENUM('OPEN', 'CLOSED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "transaction_status" AS ENUM('COMPLETED', 'VOIDED');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "payment_method" AS ENUM('CASH', 'TRANSFER', 'QRIS');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- shifts
CREATE TABLE IF NOT EXISTS "shifts" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "cashier_id"     uuid NOT NULL,
  "status"         "shift_status" NOT NULL DEFAULT 'OPEN',
  "opening_float"  integer NOT NULL,
  "closing_cash"   integer,
  "opened_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "closed_at"      timestamp with time zone
);
--> statement-breakpoint

-- transactions
CREATE TABLE IF NOT EXISTS "transactions" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "client_uuid"     varchar(36) NOT NULL,
  "shift_id"        uuid NOT NULL,
  "cashier_id"      uuid NOT NULL,
  "subtotal"        integer NOT NULL,
  "discount_amount" integer NOT NULL DEFAULT 0,
  "total"           integer NOT NULL,
  "status"          "transaction_status" NOT NULL DEFAULT 'COMPLETED',
  "void_reason"     varchar(500),
  "voided_at"       timestamp with time zone,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "transactions_client_uuid_unique" UNIQUE ("client_uuid")
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- transaction_items
CREATE TABLE IF NOT EXISTS "transaction_items" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "transaction_id"  uuid NOT NULL,
  "variant_id"      uuid NOT NULL,
  "qty"             integer NOT NULL,
  "unit_price"      integer NOT NULL,
  "discount_amount" integer NOT NULL DEFAULT 0,
  "line_total"      integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- transaction_payments
CREATE TABLE IF NOT EXISTS "transaction_payments" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "transaction_id" uuid NOT NULL,
  "method"         "payment_method" NOT NULL,
  "amount"         integer NOT NULL,
  "reference"      varchar(255)
);
--> statement-breakpoint
ALTER TABLE "transaction_payments" ADD CONSTRAINT "transaction_payments_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- journal_entries (accounting stub — Phase 7 will formalize)
CREATE TABLE IF NOT EXISTS "journal_entries" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "transaction_id" uuid NOT NULL,
  "source_type"    varchar(50) NOT NULL,
  "amount"         integer NOT NULL,
  "status"         varchar(20) NOT NULL DEFAULT 'PENDING',
  "created_at"     timestamp with time zone NOT NULL DEFAULT now()
);
