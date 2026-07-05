-- Succession (L3): critical roles, successor pipeline, readiness.
CREATE TABLE "critical_roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "business_impact" varchar(12) NOT NULL DEFAULT 'high',
  "incumbent_id" uuid REFERENCES "employees"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "impact_chk" CHECK (business_impact in ('medium','high','critical'))
);
--> statement-breakpoint
CREATE TABLE "successors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "role_id" uuid NOT NULL REFERENCES "critical_roles"("id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "rank" varchar(12) NOT NULL DEFAULT 'primary',
  "readiness" varchar(12) NOT NULL DEFAULT 'develop',
  CONSTRAINT "successor_unique" UNIQUE ("role_id","employee_id"),
  CONSTRAINT "rank_chk" CHECK (rank in ('primary','secondary','emergency')),
  CONSTRAINT "readiness_chk" CHECK (readiness in ('ready-now','1-year','2-3-years','develop'))
);
--> statement-breakpoint
ALTER TABLE "critical_roles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "successors" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "critical_roles","successors" TO hr_app;
--> statement-breakpoint
CREATE POLICY hr_app_critical_roles ON "critical_roles" TO hr_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY hr_app_successors ON "successors" TO hr_app USING (true) WITH CHECK (true);
