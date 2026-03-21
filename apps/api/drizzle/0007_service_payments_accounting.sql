-- 0007: Add service_payments table and extend journal_entries for double-entry accounting

CREATE TABLE IF NOT EXISTS "service_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "service_order_id" uuid NOT NULL,
  "amount" integer NOT NULL,
  "method" "payment_method" NOT NULL,
  "reference" varchar(100),
  "paid_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" uuid NOT NULL,
  CONSTRAINT "service_payments_service_order_id_fk" FOREIGN KEY ("service_order_id") REFERENCES "service_orders"("id")
);

CREATE INDEX "service_payments_service_order_id_idx" ON "service_payments" ("service_order_id");

ALTER TABLE "journal_entries" ADD COLUMN "debit_credit" varchar(2);
ALTER TABLE "journal_entries" ADD COLUMN "reference_id" uuid;

CREATE INDEX "journal_entries_reference_id_idx" ON "journal_entries" ("reference_id");
