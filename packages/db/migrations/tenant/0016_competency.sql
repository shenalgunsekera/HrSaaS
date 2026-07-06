-- Competency (L3): library, role requirements by designation, assessments.
CREATE TABLE "competencies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL UNIQUE,
  "category" varchar(16) NOT NULL DEFAULT 'functional',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "competency_category_chk" CHECK (category in ('core','functional','leadership','technical','behavioural'))
);
--> statement-breakpoint
CREATE TABLE "competency_requirements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "competency_id" uuid NOT NULL REFERENCES "competencies"("id") ON DELETE CASCADE,
  "designation" text NOT NULL,
  "required_level" integer NOT NULL,
  CONSTRAINT "req_level_chk" CHECK (required_level between 1 and 5),
  CONSTRAINT "req_unique" UNIQUE ("competency_id","designation")
);
--> statement-breakpoint
CREATE TABLE "competency_assessments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "competency_id" uuid NOT NULL REFERENCES "competencies"("id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "level" integer NOT NULL,
  "assessed_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "assess_level_chk" CHECK (level between 1 and 5),
  CONSTRAINT "assess_unique" UNIQUE ("competency_id","employee_id")
);
--> statement-breakpoint
ALTER TABLE "competencies" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "competency_requirements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "competency_assessments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "competencies","competency_requirements","competency_assessments" TO hr_app;
--> statement-breakpoint
CREATE POLICY hr_app_competencies ON "competencies" TO hr_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY hr_app_comp_reqs ON "competency_requirements" TO hr_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY hr_app_comp_assess ON "competency_assessments" TO hr_app USING (true) WITH CHECK (true);
