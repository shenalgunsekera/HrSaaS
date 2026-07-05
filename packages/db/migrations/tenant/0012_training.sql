-- Training (L2): course catalogue + enrollments, certification expiry,
-- mandatory-training compliance.
CREATE TABLE "courses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "category" varchar(24) NOT NULL DEFAULT 'general',
  "mandatory" boolean NOT NULL DEFAULT false,
  "duration_hours" numeric(5,1),
  "validity_months" integer,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "status" varchar(12) NOT NULL DEFAULT 'enrolled',
  "score" integer,
  "completed_at" timestamptz,
  "expires_at" date,
  CONSTRAINT "enrollment_unique" UNIQUE ("course_id","employee_id"),
  CONSTRAINT "enrollment_status_chk" CHECK (status in ('enrolled','completed','failed')),
  CONSTRAINT "enrollment_score_chk" CHECK (score is null or score between 0 and 100)
);
--> statement-breakpoint
CREATE INDEX "enrollments_expiry_idx" ON "enrollments" ("status","expires_at");
--> statement-breakpoint
ALTER TABLE "courses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "enrollments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "courses","enrollments" TO hr_app;
--> statement-breakpoint
CREATE POLICY hr_app_courses ON "courses" TO hr_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY hr_app_enrollments ON "enrollments" TO hr_app USING (true) WITH CHECK (true);
