-- Integrations & API Marketplace (L1) — API key management + webhook registry.
CREATE TABLE "api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "prefix" varchar(12) NOT NULL,
  "key_hash" varchar(64) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "last_used_at" timestamptz,
  "revoked_at" timestamptz,
  CONSTRAINT "api_key_hash_unique" UNIQUE ("key_hash")
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "url" text NOT NULL,
  "events" jsonb NOT NULL DEFAULT '[]',
  "secret" varchar(64) NOT NULL,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "webhooks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "api_keys","webhooks" TO hr_app;
--> statement-breakpoint
CREATE POLICY hr_app_api_keys ON "api_keys" TO hr_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY hr_app_webhooks ON "webhooks" TO hr_app USING (true) WITH CHECK (true);
