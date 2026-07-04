/**
 * CLI wrapper over the tenant factory (inline execution — no worker needed).
 *
 *   node scripts/provision-tenant.mjs --slug acme --name "Acme Holdings" \
 *     --tier L3 [--brand "#0D9488"] [--port 4101] [--admin admin@acme.lk]
 *
 * The admin console enqueues the same runs; services/provisioner executes
 * them unattended. Both paths share scripts/factory.mjs. Idempotent.
 */
import postgres from 'postgres';
import { applyMigrations, controlPlaneMigrationsDir, ensurePostgres } from './lib.mjs';
import { enqueueProvision, executeRun } from './factory.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
}
const { slug, name, tier = 'L1', brand, port, admin } = args;

if (!slug || !/^[a-z][a-z0-9-]{1,30}$/.test(slug)) {
  console.error('usage: --slug <kebab-slug> [--name "Legal Name"] [--tier L1..L5] [--brand "#hex"] [--port N] [--admin email]');
  process.exit(1);
}
if (!['L1', 'L2', 'L3', 'L4', 'L5'].includes(tier)) {
  console.error(`invalid tier ${tier}`);
  process.exit(1);
}

console.log(`\n▶ provisioning tenant '${slug}' (tier ${tier})`);
const cpInfo = await ensurePostgres('hr-control-plane');
const cp = postgres(`postgres://postgres:${cpInfo.password}@127.0.0.1:${cpInfo.port}/postgres`, {
  max: 1,
  onnotice: () => {},
});

try {
  await applyMigrations(cp, controlPlaneMigrationsDir(), 'control-plane');
  const { runId } = await enqueueProvision(cp, {
    slug,
    name,
    tier,
    brand,
    port: port ? Number(port) : undefined,
    adminEmail: admin,
  });
  const result = await executeRun(cp, cpInfo, runId);
  console.log(`\n✔ tenant '${slug}' live → ${result.url}`);
  console.log(`  db: hr-tenant-${slug}-db · app: hr-tenant-${slug}-app\n`);
} catch (e) {
  console.error(`\n✗ provisioning failed: ${e?.message ?? e}`);
  process.exitCode = 1;
} finally {
  await cp.end({ timeout: 2 });
}
