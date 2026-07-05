-- Onboarding/offboarding as orchestrated lifecycles (Phase 6, §8.3).
CREATE TABLE "lifecycle_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "kind" varchar(12) NOT NULL,
  "task" text NOT NULL,
  "category" varchar(24) NOT NULL,
  "display_order" integer NOT NULL DEFAULT 0,
  "done" boolean NOT NULL DEFAULT false,
  "done_at" timestamptz,
  CONSTRAINT "lifecycle_kind_chk" CHECK (kind in ('onboarding','offboarding'))
);
--> statement-breakpoint
CREATE INDEX "lifecycle_emp_idx" ON "lifecycle_tasks" ("employee_id","kind");
--> statement-breakpoint
ALTER TABLE "lifecycle_tasks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "lifecycle_tasks" TO hr_app;
--> statement-breakpoint
CREATE POLICY hr_app_lifecycle ON "lifecycle_tasks" TO hr_app USING (true) WITH CHECK (true);
