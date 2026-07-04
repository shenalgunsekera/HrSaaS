/**
 * Migration orchestration across ALL tenant databases (§4.6 seed).
 * Applies pending tenant migrations to every active tenant's dedicated DB,
 * tracked per tenant in the control plane's `tenant_migrations` ledger.
 *
 *   node scripts/migrate-tenants.mjs [--slug acme]   (default: all active)
 *
 * Wave rollout (canary cohort → fleet) arrives in Phase 9; local dev applies
 * to the fleet directly.
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

const tenants = args.slug
  ? await cp`select id, slug from tenants where slug = ${args.slug}`
  : await cp`select id, slug from tenants where status = 'active' and db_ref like 'local-docker:%' order by slug`;

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
