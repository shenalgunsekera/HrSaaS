/**
 * Per-tenant health aggregation + autosleep cost guardrail (Phase 9, §4.7–4.8).
 *
 *   node scripts/health-check.mjs [--autosleep] [--idle-min 30]
 *
 * Probes each active tenant's dedicated DB (reachable, latency, current
 * migration), snapshots into the control plane's `tenant_health`, and — with
 * --autosleep — pauses the app container of tenants idle beyond the threshold
 * (idle = no audit_log activity within the window). A slept tenant costs
 * near-nothing; the next request/redeploy wakes it. This is the dedicated-
 * compute cost mitigation the isolation model requires.
 */
import { execFileSync } from 'node:child_process';
import postgres from 'postgres';
import { dockerQuiet, ensurePostgres, loadSecret } from './lib.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 1) {
  const a = process.argv[i];
  if (a === '--autosleep') args.autosleep = true;
  else if (a.startsWith('--')) args[a.slice(2).replace(/-/g, '')] = process.argv[++i];
}
const idleMin = Number(args.idlemin ?? 30);

const cpInfo = await ensurePostgres('hr-control-plane');
const cp = postgres(`postgres://postgres:${cpInfo.password}@127.0.0.1:${cpInfo.port}/postgres`, {
  max: 1,
  onnotice: () => {},
});

const tenants = await cp`
  select id, slug, sleeping from tenants where status = 'active' and db_ref like 'local-docker:%' order by slug`;

for (const t of tenants) {
  const secret = loadSecret(`hr-tenant-${t.slug}-db`);
  let reachable = false, dbOk = false, latency = null, tag = null, idle = null;
  if (secret) {
    const tdb = postgres(`postgres://postgres:${secret.password}@127.0.0.1:${secret.port}/postgres`, {
      max: 1, onnotice: () => {}, connect_timeout: 5,
    });
    try {
      const t0 = Date.now();
      await tdb`select 1`;
      latency = Date.now() - t0;
      reachable = true;
      const [m] = await tdb`select tag from drizzle_migrations order by applied_at desc limit 1`;
      tag = m?.tag ?? null;
      const [act] = await tdb`
        select extract(epoch from (now() - max(created_at)))/60 as mins from audit_log`;
      idle = act?.mins != null ? Math.round(Number(act.mins)) : null;
      dbOk = true;
    } catch {
      /* unreachable */
    } finally {
      await tdb.end({ timeout: 2 });
    }
  }

  await cp`insert into tenant_health (tenant_id, reachable, db_ok, latency_ms, migration_tag, idle_minutes)
    values (${t.id}, ${reachable}, ${dbOk}, ${latency}, ${tag}, ${idle})`;

  let note = '';
  if (args.autosleep && dbOk && idle != null && idle >= idleMin && !t.sleeping) {
    dockerQuiet('stop', `hr-tenant-${t.slug}-app`);
    await cp`update tenants set sleeping = true where id = ${t.id}`;
    note = ` → slept (idle ${idle}m)`;
  }
  console.log(
    `  ${reachable ? '✓' : '✗'} ${t.slug}: ${dbOk ? `${latency}ms, @${tag}, idle ${idle ?? '?'}m` : 'UNREACHABLE'}${note}`,
  );
}

await cp.end();
console.log(`health snapshot recorded for ${tenants.length} tenant(s)`);
