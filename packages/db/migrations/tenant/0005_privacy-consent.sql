-- Data Privacy & Consent (L1, PDPA) — consent lifecycle + data-subject
-- requests with turnaround (SLA) tracking per ADR-0007 §8 (30-day default).
CREATE TABLE "consents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "purpose" varchar(48) NOT NULL,
  "granted_at" timestamptz NOT NULL DEFAULT now(),
  "withdrawn_at" timestamptz,
  "note" text,
  CONSTRAINT "consent_unique_active" UNIQUE ("employee_id","purpose")
);
--> statement-breakpoint
CREATE TABLE "data_subject_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id"),
  "kind" varchar(16) NOT NULL,
  "detail" text,
  "status" varchar(12) NOT NULL DEFAULT 'open',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "due_at" timestamptz NOT NULL,
  "resolved_at" timestamptz,
  "resolution" text,
  CONSTRAINT "dsr_kind_chk" CHECK (kind in ('access','correction','erasure','portability')),
  CONSTRAINT "dsr_status_chk" CHECK (status in ('open','resolved','rejected'))
);
--> statement-breakpoint
CREATE INDEX "dsr_due_idx" ON "data_subject_requests" ("status","due_at");
--> statement-breakpoint
ALTER TABLE "consents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "data_subject_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "consents","data_subject_requests" TO hr_app;
--> statement-breakpoint
CREATE POLICY hr_app_consents ON "consents" TO hr_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY hr_app_dsr ON "data_subject_requests" TO hr_app USING (true) WITH CHECK (true);
