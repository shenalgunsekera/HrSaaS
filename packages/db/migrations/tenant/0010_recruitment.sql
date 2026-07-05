-- Recruitment (L2): vacancies + applicant pipeline (feature sheet A–G core).
CREATE TABLE "vacancies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "department" text,
  "employment_type" varchar(16) NOT NULL DEFAULT 'permanent',
  "headcount" integer NOT NULL DEFAULT 1,
  "salary_min" numeric(14,2),
  "salary_max" numeric(14,2),
  "status" varchar(12) NOT NULL DEFAULT 'open',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "vacancy_status_chk" CHECK (status in ('open','on-hold','closed'))
);
--> statement-breakpoint
CREATE TABLE "candidates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "vacancy_id" uuid NOT NULL REFERENCES "vacancies"("id") ON DELETE CASCADE,
  "full_name" text NOT NULL,
  "email" text NOT NULL,
  "phone" varchar(32),
  "source" varchar(24) NOT NULL DEFAULT 'career-portal',
  "expected_salary" numeric(14,2),
  "status" varchar(16) NOT NULL DEFAULT 'applied',
  "note" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "candidate_status_chk" CHECK (status in ('applied','shortlisted','interview','offered','hired','rejected'))
);
--> statement-breakpoint
CREATE INDEX "candidates_pipeline_idx" ON "candidates" ("vacancy_id","status");
--> statement-breakpoint
ALTER TABLE "vacancies" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "candidates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "vacancies","candidates" TO hr_app;
--> statement-breakpoint
CREATE POLICY hr_app_vacancies ON "vacancies" TO hr_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY hr_app_candidates ON "candidates" TO hr_app USING (true) WITH CHECK (true);
