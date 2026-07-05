-- Compensation & Total Rewards (L2): salary bands + compa-ratio basis.
-- Expand-only: adds salary_grade to employees (backward-compatible §4.6).
CREATE TABLE "salary_bands" (
  "grade" varchar(16) PRIMARY KEY,
  "band_min" numeric(14,2) NOT NULL,
  "band_mid" numeric(14,2) NOT NULL,
  "band_max" numeric(14,2) NOT NULL,
  "notes" text,
  CONSTRAINT "band_order_chk" CHECK (band_min <= band_mid and band_mid <= band_max)
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "salary_grade" varchar(16) REFERENCES "salary_bands"("grade");
--> statement-breakpoint
ALTER TABLE "salary_bands" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "salary_bands" TO hr_app;
--> statement-breakpoint
CREATE POLICY hr_app_bands ON "salary_bands" TO hr_app USING (true) WITH CHECK (true);
