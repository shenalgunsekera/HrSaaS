-- Dynamic schema engine storage (Phase 4, ADR-0006).
-- Definitions are versioned rows (immutable once published); values live in
-- JSONB with engine-enforced validation — never EAV. GIN index for querying.
CREATE TABLE "object_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" varchar(64) NOT NULL,
  "version" integer NOT NULL,
  "status" varchar(16) NOT NULL DEFAULT 'published',
  "definition" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "object_def_key_version_unique" UNIQUE ("key", "version")
);
--> statement-breakpoint
CREATE INDEX "object_def_key_idx" ON "object_definitions" ("key", "status");
--> statement-breakpoint
CREATE TABLE "custom_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "object_key" varchar(64) NOT NULL,
  "definition_version" integer NOT NULL,
  "data" jsonb NOT NULL,
  "created_by" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "custom_records_object_idx" ON "custom_records" ("object_key", "created_at");
--> statement-breakpoint
CREATE INDEX "custom_records_data_gin" ON "custom_records" USING gin ("data");
--> statement-breakpoint
ALTER TABLE "object_definitions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "custom_records" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "object_definitions", "custom_records" TO hr_app;
--> statement-breakpoint
CREATE POLICY hr_app_object_defs ON "object_definitions" TO hr_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY hr_app_custom_records ON "custom_records" TO hr_app USING (true) WITH CHECK (true);
