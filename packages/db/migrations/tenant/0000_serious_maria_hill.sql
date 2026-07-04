CREATE TYPE "public"."member_role" AS ENUM('employee', 'manager', 'hr', 'payroll-admin', 'tenant-admin');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_member_id" uuid,
	"action" varchar(64) NOT NULL,
	"object_key" varchar(64),
	"record_id" text,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holiday_calendars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country" varchar(2) DEFAULT 'LK' NOT NULL,
	"year" integer NOT NULL,
	"holidays" jsonb NOT NULL
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
	"source" text
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
	"source" text
);
--> statement-breakpoint
CREATE TABLE "tenant_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"role" "member_role" DEFAULT 'employee' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_meta" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "t_audit_object_idx" ON "audit_log" USING btree ("object_key","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "t_holiday_calendar_unique" ON "holiday_calendars" USING btree ("country","year");--> statement-breakpoint
CREATE INDEX "t_statutory_rates_lookup_idx" ON "statutory_rates" USING btree ("country","kind","effective_from");--> statement-breakpoint
CREATE INDEX "t_tax_tables_lookup_idx" ON "tax_tables" USING btree ("country","name","effective_from");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_members_email_idx" ON "tenant_members" USING btree ("email");