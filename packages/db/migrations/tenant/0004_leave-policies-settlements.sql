-- Leave entitlement policies + final settlements (Phase 6 cont.)
CREATE TABLE "leave_policies" (
  "leave_type" varchar(16) PRIMARY KEY,
  "annual_days" numeric(5,2) NOT NULL,
  "notes" text
);
--> statement-breakpoint
-- Sri Lanka Shop & Office Act conventional defaults; tenant-admin adjustable.
INSERT INTO "leave_policies" ("leave_type","annual_days","notes") VALUES
  ('annual', 14, 'Shop & Office Act convention'),
  ('casual', 7, 'Shop & Office Act convention'),
  ('medical', 7, 'common policy default'),
  ('maternity', 84, '84 working days, first/second child'),
  ('paternity', 3, 'common policy default'),
  ('lieu', 0, 'earned, not entitled'),
  ('study', 0, 'discretionary'),
  ('special', 0, 'discretionary'),
  ('compassionate', 3, 'common policy default')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE TABLE "final_settlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id"),
  "last_day" date NOT NULL,
  "reason" varchar(16) NOT NULL,
  "completed_years" integer NOT NULL,
  "last_basic" numeric(14,2) NOT NULL,
  "gratuity" numeric(14,2) NOT NULL,
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "settlement_reason_chk" CHECK (reason in ('resigned','retired','terminated','deceased')),
  CONSTRAINT "settlement_employee_unique" UNIQUE ("employee_id")
);
--> statement-breakpoint
ALTER TABLE "leave_policies" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "final_settlements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, UPDATE ON "leave_policies" TO hr_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON "final_settlements" TO hr_app;
--> statement-breakpoint
CREATE POLICY hr_app_leave_policies ON "leave_policies" TO hr_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY hr_app_settlements ON "final_settlements" TO hr_app USING (true) WITH CHECK (true);
