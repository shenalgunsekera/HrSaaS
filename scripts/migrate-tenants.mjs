/**
 * Migration orchestration across tenant databases (§4.6), tracked per tenant
 * in the control plane's `tenant_migrations` ledger.
 *
 *   node scripts/migrate-tenants.mjs                      all active tenants
 *   node scripts/migrate-tenants.mjs --slug acme          one tenant
 *   node scripts/migrate-tenants.mjs --canary globex,acme  wave 1 (cohort)
 *   node scripts/migrate-tenants.mjs --rest globex,acme    wave 2 (complement)
 *
 * Wave rollout: migrate the canary cohort first, verify, then --rest applies
 * to everyone NOT in that cohort. Migrations are expand→migrate→contract
 * (backward-compatible) so code and schema never move in lockstep.
 */
import postgres from 'postgres';
import { applyMigrations, ensurePostgres, loadSecret, tenantMigrationsDir } from './lib.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  args[process.argv[i]?.replace(/^--/, '')] = process.argv[i + 1];
}

const cpInfo = await ensurePostgres('hr-control-plane');
const cp = postgres(`postgres://postgres:${cpInfo.password}@127.0.0.1:${cpInfo.port}/postgres`, {
  max: 1,
  onnotice: () => {},
});

const cohort = (args.canary ?? args.rest ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const all = args.slug
  ? await cp`select id, slug from tenants where slug = ${args.slug}`
  : await cp`select id, slug from tenants where status = 'active' and db_ref like 'local-docker:%' order by slug`;
const tenants = args.canary
  ? all.filter((t) => cohort.includes(t.slug))
  : args.rest
    ? all.filter((t) => !cohort.includes(t.slug))
    : all;

if (args.canary) console.log(`wave: canary cohort [${tenants.map((t) => t.slug).join(', ')}]`);
if (args.rest) console.log(`wave: fleet remainder [${tenants.map((t) => t.slug).join(', ')}]`);

let failed = 0;
for (const t of tenants) {
  const secret = loadSecret(`hr-tenant-${t.slug}-db`);
  if (!secret) {
    console.error(`  ✗ ${t.slug}: no datastore secret`);
    failed++;
    continue;
  }
  const tdb = postgres(`postgres://postgres:${secret.password}@127.0.0.1:${secret.port}/postgres`, {
    max: 1,
    onnotice: () => {},
  });
  try {
    const applied = await applyMigrations(tdb, tenantMigrationsDir(), `tenant ${t.slug}`);
    for (const tag of applied) {
      await cp`insert into tenant_migrations (tenant_id, migration_tag, succeeded)
        values (${t.id}, ${tag}, true) on conflict do nothing`;
    }
  } catch (e) {
    failed++;
    console.error(`  ✗ ${t.slug}: ${e?.message ?? e}`);
    await cp`insert into tenant_migrations (tenant_id, migration_tag, succeeded, error)
      values (${t.id}, 'FAILED', false, ${String(e?.message ?? e)}) on conflict do nothing`;
  } finally {
    await tdb.end({ timeout: 2 });
  }
}

await cp.end();
if (failed) {
  console.error(`${failed} tenant(s) failed`);
  process.exit(1);
}
console.log(`migrations current on ${tenants.length} tenant database(s)`);
