-- Contractor & Gig Workforce (L1) — core classification + compliance slice.
CREATE TABLE "contractors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "contractor_number" varchar(32) NOT NULL,
  "full_name" text NOT NULL,
  "nic" varchar(20),
  "contractor_type" varchar(16) NOT NULL,
  "engagement_basis" varchar(16) NOT NULL,
  "rate" numeric(14,2) NOT NULL,
  "agency" text,
  "contract_start" date NOT NULL,
  "contract_end" date,
  "work_permit_status" varchar(24),
  "status" varchar(16) NOT NULL DEFAULT 'active',
  "custom" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "contractor_number_unique" UNIQUE ("contractor_number"),
  CONSTRAINT "contractor_type_chk" CHECK (contractor_type in ('fixed-term','casual','gig','outsourced','retainer')),
  CONSTRAINT "engagement_basis_chk" CHECK (engagement_basis in ('daily','piece-rate','project','hourly')),
  CONSTRAINT "contractor_status_chk" CHECK (status in ('active','ended','converted'))
);
--> statement-breakpoint
CREATE INDEX "contractor_expiry_idx" ON "contractors" ("status","contract_end");
--> statement-breakpoint
ALTER TABLE "contractors" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "contractors" TO hr_app;
--> statement-breakpoint
CREATE POLICY hr_app_contractors ON "contractors" TO hr_app USING (true) WITH CHECK (true);
