-- Skills Intelligence & Talent Marketplace (L3): verified skills + internal gigs.
CREATE TABLE "skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "employee_skills" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "skill_id" uuid NOT NULL REFERENCES "skills"("id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "proficiency" integer NOT NULL DEFAULT 3,
  "verified" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "emp_skill_prof_chk" CHECK (proficiency between 1 and 5),
  CONSTRAINT "emp_skill_unique" UNIQUE ("skill_id","employee_id")
);
--> statement-breakpoint
CREATE TABLE "gigs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "department" text,
  "skill_id" uuid REFERENCES "skills"("id") ON DELETE SET NULL,
  "status" varchar(12) NOT NULL DEFAULT 'open',
  "assignee_id" uuid REFERENCES "employees"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "gig_status_chk" CHECK (status in ('open','filled','closed'))
);
--> statement-breakpoint
ALTER TABLE "skills" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "employee_skills" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "gigs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "skills","employee_skills","gigs" TO hr_app;
--> statement-breakpoint
CREATE POLICY hr_app_skills ON "skills" TO hr_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY hr_app_emp_skills ON "employee_skills" TO hr_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY hr_app_gigs ON "gigs" TO hr_app USING (true) WITH CHECK (true);
