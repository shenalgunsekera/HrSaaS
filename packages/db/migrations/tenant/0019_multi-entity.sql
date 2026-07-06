-- Multi-Entity / Multi-Country Payroll (L3): legal entities + employee mapping.
-- Expand-only: employees gain an optional entity link (default null = primary).
CREATE TABLE "legal_entities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "country" varchar(2) NOT NULL DEFAULT 'LK',
  "currency" varchar(3) NOT NULL DEFAULT 'LKR',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "entity_name_unique" UNIQUE ("name")
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "entity_id" uuid REFERENCES "legal_entities"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "legal_entities" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "legal_entities" TO hr_app;
--> statement-breakpoint
CREATE POLICY hr_app_entities ON "legal_entities" TO hr_app USING (true) WITH CHECK (true);
