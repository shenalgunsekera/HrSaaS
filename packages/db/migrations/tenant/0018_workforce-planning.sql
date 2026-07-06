-- Workforce Planning & Org Design (L3): headcount budgets + positions.
CREATE TABLE "headcount_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "department" text NOT NULL,
  "period" varchar(7) NOT NULL,
  "approved_headcount" integer NOT NULL,
  "budget_cost" numeric(16,2),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "plan_unique" UNIQUE ("department","period"),
  CONSTRAINT "plan_hc_chk" CHECK (approved_headcount >= 0)
);
--> statement-breakpoint
CREATE TABLE "positions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "department" text NOT NULL,
  "status" varchar(12) NOT NULL DEFAULT 'open',
  "holder_id" uuid REFERENCES "employees"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "position_status_chk" CHECK (status in ('open','filled','frozen'))
);
--> statement-breakpoint
ALTER TABLE "headcount_plans" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "positions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "headcount_plans","positions" TO hr_app;
--> statement-breakpoint
CREATE POLICY hr_app_headcount ON "headcount_plans" TO hr_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY hr_app_positions ON "positions" TO hr_app USING (true) WITH CHECK (true);
