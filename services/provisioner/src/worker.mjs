/**
 * Provisioner worker — the unattended factory (Phase 2).
 *
 *   node services/provisioner/src/worker.mjs
 *
 * Polls the control plane for queued provisioning runs, claims one at a time
 * with FOR UPDATE SKIP LOCKED (safe with multiple workers), and executes the
 * shared pipeline (scripts/factory.mjs). A claimed run that fails stays
 * 'failed' with its step ledger intact; re-queueing it (admin console) resumes
 * from the failed step. Applies pending control-plane migrations on boot.
 *
 * Local driver note: needs the docker CLI + hr-app:dev image on this host.
 * The production worker is this same loop with Supabase/platform drivers.
 */
import postgres from 'postgres';
import {
  applyMigrations,
  controlPlaneMigrationsDir,
  ensurePostgres,
} from '../../../scripts/lib.mjs';
import { executeRun } from '../../../scripts/factory.mjs';

const POLL_MS = 3000;

const cpInfo = await ensurePostgres('hr-control-plane');
const cp = postgres(`postgres://postgres:${cpInfo.password}@127.0.0.1:${cpInfo.port}/postgres`, {
  max: 2,
  onnotice: () => {},
});
await applyMigrations(cp, controlPlaneMigrationsDir(), 'control-plane');

console.log(`provisioner worker up — polling every ${POLL_MS}ms`);

let stopping = false;
process.on('SIGINT', () => (stopping = true));
process.on('SIGTERM', () => (stopping = true));

while (!stopping) {
  let claimed = null;
  try {
    claimed = await cp.begin(async (tx) => {
      const [row] = await tx`
        select id from provisioning_runs
        where status = 'queued'
        order by created_at
        for update skip locked
        limit 1`;
      if (!row) return null;
      await tx`update provisioning_runs set status = 'running', started_at = coalesce(started_at, now()),
        attempt = attempt + 1 where id = ${row.id}`;
      return row.id;
    });
  } catch (e) {
    console.error(`claim error: ${e?.message ?? e}`);
  }

  if (claimed) {
    console.log(`▶ run ${claimed}`);
    try {
      const result = await executeRun(cp, cpInfo, claimed);
      console.log(`✔ run ${claimed} complete → ${result.url}`);
    } catch (e) {
      console.error(`✗ run ${claimed} failed: ${e?.message ?? e}`);
    }
  } else {
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

await cp.end({ timeout: 2 });
console.log('worker stopped');
