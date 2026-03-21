-- S02: Service Catalog + Service Order tables
CREATE TYPE "work_status" AS ENUM ('BOOKING', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED');
CREATE TYPE "payment_status" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

CREATE TABLE "service_catalog" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" varchar(255) NOT NULL,
  "description" text,
  "default_price" integer NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE "service_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_number" varchar(20) NOT NULL,
  "vehicle_id" uuid NOT NULL REFERENCES "vehicles"("id"),
  "mechanic_id" uuid,
  "work_status" "work_status" NOT NULL DEFAULT 'BOOKING',
  "payment_status" "payment_status" NOT NULL DEFAULT 'UNPAID',
  "complaint" text,
  "estimated_completion_at" timestamp with time zone,
  "estimated_cost" integer,
  "booking_date" timestamp with time zone,
  "checked_in_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_by" uuid NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "service_orders_order_number_idx" ON "service_orders" ("order_number");
CREATE INDEX "service_orders_vehicle_id_idx" ON "service_orders" ("vehicle_id");
