/**
 * Automated tenant teardown (hard cancellation / PDPA erasure path).
 *   node scripts/teardown-tenant.mjs --slug acme [--erase-registry]
 * Removes app container, database container AND its volume (data destroyed),
 * secrets, and marks the control-plane row erased. Idempotent.
 */
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { dockerQuiet, ensurePostgres, loadSecret, secretsDir } from './lib.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
}
const slug = args.slug;
if (!slug) {
  console.error('usage: --slug <slug>');
  process.exit(1);
}

const dbContainer = `hr-tenant-${slug}-db`;
const appContainer = `hr-tenant-${slug}-app`;

console.log(`▶ tearing down tenant '${slug}'`);
for (const c of [appContainer, dbContainer]) {
  dockerQuiet('rm', '-f', c);
  console.log(`  ✓ removed container ${c}`);
}
dockerQuiet('volume', 'rm', `${dbContainer}-data`);
console.log(`  ✓ removed volume ${dbContainer}-data (data erased)`);

const secretFile = path.join(secretsDir, `${dbContainer}.json`);
if (existsSync(secretFile)) rmSync(secretFile);

if (loadSecret('hr-control-plane')) {
  const cpInfo = await ensurePostgres('hr-control-plane');
  const cp = postgres(`postgres://postgres:${cpInfo.password}@127.0.0.1:${cpInfo.port}/postgres`, { max: 1, onnotice: () => {} });
  const [tenant] = await cp`select id from tenants where slug = ${slug}`;
  if (tenant) {
    await cp`update tenants set status = 'erased', db_ref = null, updated_at = now() where id = ${tenant.id}`;
    await cp`insert into provisioning_runs (tenant_id, kind, status, started_at, finished_at)
      values (${tenant.id}, 'teardown', 'complete', now(), now())`;
    await cp`insert into control_plane_audit_log (actor, action, tenant_id, detail)
      values ('factory', 'tenant.erased', ${tenant.id}, ${cp.json({ driver: 'local-docker' })})`;
    console.log('  ✓ control plane: status=erased, teardown + audit recorded');
  }
  await cp.end();
}
console.log(`✔ tenant '${slug}' torn down\n`);
