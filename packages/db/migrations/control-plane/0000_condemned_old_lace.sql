CREATE TYPE "public"."billing_status" AS ENUM('trial', 'active', 'past_due', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."domain_status" AS ENUM('pending_dns', 'verifying', 'issuing_cert', 'active', 'expiring_soon', 'failed');--> statement-breakpoint
CREATE TYPE "public"."domain_type" AS ENUM('platform_subdomain', 'custom');--> statement-breakpoint
CREATE TYPE "public"."provisioning_status" AS ENUM('queued', 'running', 'failed', 'complete');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('prospect', 'provisioning', 'active', 'suspended', 'downgraded_locked', 'pending_erasure', 'erased');--> statement-breakpoint
CREATE TYPE "public"."tier" AS ENUM('L1', 'L2', 'L3', 'L4', 'L5');--> statement-breakpoint
CREATE TABLE "control_plane_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" text NOT NULL,
	"action" varchar(64) NOT NULL,
	"tenant_id" uuid,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holiday_calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country" varchar(2) DEFAULT 'LK' NOT NULL,
	"year" integer NOT NULL,
	"holidays" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" varchar(32),
	"headcount" integer,
	"interested_tier" "tier",
	"consultation_at" timestamp with time zone,
	"scheduler_ref" text,
	"branding_intake" jsonb,
	"notes" text,
	"converted_tenant_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provisioning_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" varchar(32) NOT NULL,
	"status" "provisioning_status" DEFAULT 'queued' NOT NULL,
	"steps" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statutory_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country" varchar(2) DEFAULT 'LK' NOT NULL,
	"kind" varchar(32) NOT NULL,
	"rate_percent" numeric(6, 3),
	"params" jsonb,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country" varchar(2) DEFAULT 'LK' NOT NULL,
	"name" varchar(64) NOT NULL,
	"brackets" jsonb NOT NULL,
	"reliefs" jsonb,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"hostname" text NOT NULL,
	"type" "domain_type" NOT NULL,
	"status" "domain_status" DEFAULT 'pending_dns' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"cert_expires_at" timestamp with time zone,
	"last_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_entitlement_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"module_key" varchar(64) NOT NULL,
	"enabled" boolean NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"reason" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_migrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"migration_tag" varchar(128) NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"succeeded" boolean NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(63) NOT NULL,
	"legal_name" text NOT NULL,
	"display_name" text NOT NULL,
	"region" varchar(32) DEFAULT 'ap-south-1' NOT NULL,
	"data_residency" varchar(2) DEFAULT 'LK' NOT NULL,
	"tier" "tier" DEFAULT 'L1' NOT NULL,
	"status" "tenant_status" DEFAULT 'prospect' NOT NULL,
	"billing_status" "billing_status" DEFAULT 'trial' NOT NULL,
	"db_ref" varchar(128),
	"deployed_version" varchar(64),
	"max_tier_held" "tier" DEFAULT 'L1' NOT NULL,
	"retention_days" integer DEFAULT 365 NOT NULL,
	"theme" jsonb,
	"autosleep_enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "control_plane_audit_log" ADD CONSTRAINT "control_plane_audit_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_converted_tenant_id_tenants_id_fk" FOREIGN KEY ("converted_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provisioning_runs" ADD CONSTRAINT "provisioning_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_domains" ADD CONSTRAINT "tenant_domains_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_entitlement_overrides" ADD CONSTRAINT "tenant_entitlement_overrides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_migrations" ADD CONSTRAINT "tenant_migrations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cp_audit_tenant_idx" ON "control_plane_audit_log" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "holiday_calendar_unique" ON "holiday_calendars" USING btree ("country","year");--> statement-breakpoint
CREATE INDEX "prospects_email_idx" ON "prospects" USING btree ("email");--> statement-breakpoint
CREATE INDEX "provisioning_runs_tenant_idx" ON "provisioning_runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "statutory_rates_lookup_idx" ON "statutory_rates" USING btree ("country","kind","effective_from");--> statement-breakpoint
CREATE INDEX "tax_tables_lookup_idx" ON "tax_tables" USING btree ("country","name","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_domains_hostname_idx" ON "tenant_domains" USING btree ("hostname");--> statement-breakpoint
CREATE INDEX "tenant_domains_tenant_idx" ON "tenant_domains" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_domains_cert_expiry_idx" ON "tenant_domains" USING btree ("cert_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "entitlement_override_unique" ON "tenant_entitlement_overrides" USING btree ("tenant_id","module_key");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_migration_unique" ON "tenant_migrations" USING btree ("tenant_id","migration_tag");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_slug_idx" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tenants_status_idx" ON "tenants" USING btree ("status");