-- Phase 9 hardening: backup ledger + tenant health snapshots (control plane).
CREATE TABLE "tenant_backups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "artifact" text NOT NULL,
  "size_bytes" bigint,
  "restore_tested" boolean NOT NULL DEFAULT false,
  "restore_verified_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "tenant_backups_idx" ON "tenant_backups" ("tenant_id","created_at");
--> statement-breakpoint
CREATE TABLE "tenant_health" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "reachable" boolean NOT NULL,
  "db_ok" boolean NOT NULL,
  "latency_ms" integer,
  "migration_tag" text,
  "idle_minutes" integer,
  "checked_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "tenant_health_idx" ON "tenant_health" ("tenant_id","checked_at");
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "sleeping" boolean NOT NULL DEFAULT false;
