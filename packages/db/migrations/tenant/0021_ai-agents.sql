-- AI Assistant & Agent Orchestration (L5) with governance.
-- Agent actions require human approval before execution; everything logged.
CREATE TABLE "ai_queries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "question" text NOT NULL,
  "answer" text NOT NULL,
  "grounded_on" jsonb NOT NULL DEFAULT '[]',
  "asked_by" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent" varchar(24) NOT NULL,
  "intent" text NOT NULL,
  "proposed_action" jsonb NOT NULL,
  "status" varchar(16) NOT NULL DEFAULT 'awaiting_approval',
  "requires_approval" boolean NOT NULL DEFAULT true,
  "approved_by" text,
  "executed_at" timestamptz,
  "result" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "agent_status_chk" CHECK (status in ('awaiting_approval','approved','executed','rejected','failed'))
);
--> statement-breakpoint
CREATE INDEX "agent_tasks_status_idx" ON "agent_tasks" ("status");
--> statement-breakpoint
ALTER TABLE "ai_queries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "agent_tasks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON "ai_queries","agent_tasks" TO hr_app;
--> statement-breakpoint
CREATE POLICY hr_app_ai_queries ON "ai_queries" TO hr_app USING (true) WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY hr_app_agent_tasks ON "agent_tasks" TO hr_app USING (true) WITH CHECK (true);
