-- Employee Financial Wellness (L1) — salary advances & loans with
-- outstanding-balance tracking; installments recover through payroll.
CREATE TABLE "advances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id"),
  "kind" varchar(8) NOT NULL,
  "principal" numeric(14,2) NOT NULL,
  "monthly_installment" numeric(14,2) NOT NULL,
  "outstanding" numeric(14,2) NOT NULL,
  "status" varchar(12) NOT NULL DEFAULT 'pending',
  "reason" text,
  "requested_at" timestamptz NOT NULL DEFAULT now(),
  "approved_at" timestamptz,
  CONSTRAINT "advance_kind_chk" CHECK (kind in ('advance','loan')),
  CONSTRAINT "advance_status_chk" CHECK (status in ('pending','active','settled','rejected'))
);
--> statement-breakpoint
CREATE INDEX "advances_active_idx" ON "advances" ("employee_id","status");
--> statement-breakpoint
ALTER TABLE "advances" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "advances" TO hr_app;
--> statement-breakpoint
CREATE POLICY hr_app_advances ON "advances" TO hr_app USING (true) WITH CHECK (true);
