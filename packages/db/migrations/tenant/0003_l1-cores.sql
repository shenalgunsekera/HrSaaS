-- L1 module cores (Phase 6): FIXED, TYPED schema — statutory/payroll
-- integrity-critical entities are never metadata-driven (non-negotiable #4).
-- Custom fields on these cores live in the `custom` JSONB column, governed
-- by the schema engine.
CREATE TABLE "employees" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_number" varchar(32) NOT NULL,
  "full_name" text NOT NULL,
  "nic" varchar(20),
  "email" text,
  "date_joined" date NOT NULL,
  "employment_status" varchar(16) NOT NULL DEFAULT 'permanent',
  "department" text,
  "designation" text,
  "basic_salary" numeric(14,2) NOT NULL DEFAULT 0,
  "fixed_allowances" jsonb NOT NULL DEFAULT '{}',
  "payment_method" varchar(8) NOT NULL DEFAULT 'bank',
  "bank_name" text,
  "bank_branch" text,
  "account_number" text,
  "epf_number" varchar(32),
  "etf_number" varchar(32),
  "tin" varchar(32),
  "status" varchar(16) NOT NULL DEFAULT 'active',
  "custom" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "employees_number_unique" UNIQUE ("employee_number")
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "day" date NOT NULL,
  "clock_in" time,
  "clock_out" time,
  "status" varchar(12) NOT NULL DEFAULT 'present',
  "source" varchar(16) NOT NULL DEFAULT 'manual',
  "note" text,
  CONSTRAINT "attendance_status_chk" CHECK (status in ('present','absent','late','half-day','leave')),
  CONSTRAINT "attendance_unique_day" UNIQUE ("employee_id","day")
);
--> statement-breakpoint
CREATE INDEX "attendance_day_idx" ON "attendance_records" ("day");
--> statement-breakpoint
CREATE TABLE "leave_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "leave_type" varchar(16) NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "days" numeric(5,2) NOT NULL,
  "status" varchar(12) NOT NULL DEFAULT 'pending',
  "reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "leave_type_chk" CHECK (leave_type in ('annual','casual','medical','no-pay','maternity','paternity','lieu','study','special','compassionate')),
  CONSTRAINT "leave_status_chk" CHECK (status in ('pending','approved','rejected','cancelled'))
);
--> statement-breakpoint
CREATE INDEX "leave_period_idx" ON "leave_requests" ("employee_id","start_date");
--> statement-breakpoint
CREATE TABLE "payroll_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "period" char(7) NOT NULL,
  "status" varchar(12) NOT NULL DEFAULT 'draft',
  "totals" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "approved_at" timestamptz,
  CONSTRAINT "payroll_run_period_unique" UNIQUE ("period"),
  CONSTRAINT "payroll_status_chk" CHECK (status in ('draft','approved','locked'))
);
--> statement-breakpoint
CREATE TABLE "payslips" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_id" uuid NOT NULL REFERENCES "payroll_runs"("id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id"),
  "basic" numeric(14,2) NOT NULL,
  "allowances" jsonb NOT NULL DEFAULT '{}',
  "gross" numeric(14,2) NOT NULL,
  "no_pay_days" numeric(5,2) NOT NULL DEFAULT 0,
  "no_pay_deduction" numeric(14,2) NOT NULL DEFAULT 0,
  "epf_employee" numeric(14,2) NOT NULL,
  "epf_employer" numeric(14,2) NOT NULL,
  "etf_employer" numeric(14,2) NOT NULL,
  "apit" numeric(14,2) NOT NULL,
  "net" numeric(14,2) NOT NULL,
  "detail" jsonb NOT NULL DEFAULT '{}',
  CONSTRAINT "payslip_unique" UNIQUE ("run_id","employee_id")
);
--> statement-breakpoint
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "attendance_records" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "leave_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payroll_runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payslips" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "employees","attendance_records","leave_requests","payroll_runs","payslips" TO hr_app;
--> statement-breakpoint
CREATE POLICY hr_app_employees ON "employees" TO hr_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY hr_app_attendance ON "attendance_records" TO hr_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY hr_app_leave ON "leave_requests" TO hr_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY hr_app_payroll_runs ON "payroll_runs" TO hr_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY hr_app_payslips ON "payslips" TO hr_app USING (true) WITH CHECK (true);
