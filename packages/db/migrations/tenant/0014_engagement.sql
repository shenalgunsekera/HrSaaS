-- Employee Experience & Engagement (L2): pulse surveys + eNPS responses.
CREATE TABLE "surveys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "question" text NOT NULL,
  "anonymous" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "closed_at" timestamptz
);
--> statement-breakpoint
CREATE TABLE "survey_responses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "survey_id" uuid NOT NULL REFERENCES "surveys"("id") ON DELETE CASCADE,
  "employee_id" uuid REFERENCES "employees"("id") ON DELETE SET NULL,
  "score" integer NOT NULL,
  "comment" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "response_score_chk" CHECK (score between 0 and 10)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "response_once_per_employee" ON "survey_responses" ("survey_id","employee_id")
  WHERE employee_id IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "surveys" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "survey_responses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "surveys","survey_responses" TO hr_app;
--> statement-breakpoint
CREATE POLICY hr_app_surveys ON "surveys" TO hr_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY hr_app_responses ON "survey_responses" TO hr_app USING (true) WITH CHECK (true);
