-- Disciplinary & Grievance (L1-available, tightly access-controlled).
-- Legally sensitive: confidential case records, HR/tenant-admin only.
CREATE TABLE "cases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "case_number" varchar(24) NOT NULL UNIQUE,
  "kind" varchar(12) NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "summary" text NOT NULL,
  "severity" varchar(12) NOT NULL DEFAULT 'minor',
  "status" varchar(12) NOT NULL DEFAULT 'open',
  "outcome" text,
  "opened_by" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "closed_at" timestamptz,
  CONSTRAINT "case_kind_chk" CHECK (kind in ('disciplinary','grievance')),
  CONSTRAINT "case_severity_chk" CHECK (severity in ('minor','major','gross')),
  CONSTRAINT "case_status_chk" CHECK (status in ('open','investigating','closed'))
);
--> statement-breakpoint
CREATE TABLE "case_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "case_id" uuid NOT NULL REFERENCES "cases"("id") ON DELETE CASCADE,
  "note" text NOT NULL,
  "author" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "cases_status_idx" ON "cases" ("status","kind");
--> statement-breakpoint
ALTER TABLE "cases" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "case_notes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "cases","case_notes" TO hr_app;
--> statement-breakpoint
CREATE POLICY hr_app_cases ON "cases" TO hr_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY hr_app_case_notes ON "case_notes" TO hr_app USING (true) WITH CHECK (true);
