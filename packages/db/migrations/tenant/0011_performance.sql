-- Performance (L2): goals with weightage + review cycles with weighted rating.
CREATE TABLE "goals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "weight" numeric(5,2) NOT NULL DEFAULT 1,
  "target_date" date,
  "progress" integer NOT NULL DEFAULT 0,
  "status" varchar(12) NOT NULL DEFAULT 'active',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "goal_progress_chk" CHECK (progress between 0 and 100),
  CONSTRAINT "goal_status_chk" CHECK (status in ('active','achieved','dropped'))
);
--> statement-breakpoint
CREATE TABLE "performance_reviews" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE CASCADE,
  "period" varchar(12) NOT NULL,
  "self_rating" integer,
  "manager_rating" integer,
  "final_rating" numeric(4,2),
  "status" varchar(12) NOT NULL DEFAULT 'draft',
  "comments" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "review_unique" UNIQUE ("employee_id","period"),
  CONSTRAINT "review_ratings_chk" CHECK (
    (self_rating is null or self_rating between 1 and 5) and
    (manager_rating is null or manager_rating between 1 and 5)),
  CONSTRAINT "review_status_chk" CHECK (status in ('draft','submitted','finalized'))
);
--> statement-breakpoint
ALTER TABLE "goals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "performance_reviews" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "goals","performance_reviews" TO hr_app;
--> statement-breakpoint
CREATE POLICY hr_app_goals ON "goals" TO hr_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY hr_app_reviews ON "performance_reviews" TO hr_app USING (true) WITH CHECK (true);
