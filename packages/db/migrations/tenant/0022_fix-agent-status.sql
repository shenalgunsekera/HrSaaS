-- Fix: 'awaiting_approval' (17 chars) exceeds varchar(16); widen to 20.
ALTER TABLE "agent_tasks" ALTER COLUMN "status" TYPE varchar(20);
