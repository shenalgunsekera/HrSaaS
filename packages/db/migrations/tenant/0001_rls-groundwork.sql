-- RLS groundwork (defense in depth inside each DEDICATED tenant database).
--
-- Every tenant table gets row level security ENABLED now. With no policies,
-- any non-owner connection is denied by default. The factory's app role
-- (`hr_app`) gets explicit permissive policies for the tables the app layer
-- legitimately touches; per-USER scoping policies (self/team/all keyed to
-- auth claims) are added when Supabase Auth is wired in the production
-- driver — this migration establishes the deny-by-default posture so those
-- policies tighten, never loosen.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hr_app') THEN
    CREATE ROLE hr_app NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
ALTER TABLE "tenant_members" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_meta" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "statutory_rates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tax_tables" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "holiday_calendars" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "tenant_members", "tenant_meta" TO hr_app;
--> statement-breakpoint
GRANT SELECT ON "statutory_rates", "tax_tables", "holiday_calendars" TO hr_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON "audit_log" TO hr_app;
--> statement-breakpoint
CREATE POLICY hr_app_members ON "tenant_members" TO hr_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY hr_app_meta ON "tenant_meta" TO hr_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY hr_app_rates ON "statutory_rates" FOR SELECT TO hr_app USING (true);
--> statement-breakpoint
CREATE POLICY hr_app_tax ON "tax_tables" FOR SELECT TO hr_app USING (true);
--> statement-breakpoint
CREATE POLICY hr_app_holidays ON "holiday_calendars" FOR SELECT TO hr_app USING (true);
--> statement-breakpoint
CREATE POLICY hr_app_audit ON "audit_log" TO hr_app USING (true) WITH CHECK (true);
