/**
 * Redeploy tenant app containers onto the CURRENT hr-app:dev image —
 * one versioned artifact for all tenants (§4.6). Keeps each container's
 * existing published port and env shape; migrations are the factory's job.
 *
 *   node scripts/redeploy-tenant.mjs --slug acme
 *   node scripts/redeploy-tenant.mjs --all
 */
import postgres from 'postgres';
import {
  docker,
  dockerQuiet,
  ensurePostgres,
  gitVersion,
  loadSecret,
  NETWORK,
} from './lib.mjs';
import { defaultPort } from './factory.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 1) {
  const a = process.argv[i];
  if (a === '--all') args.all = true;
  else if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i];
}

const cpInfo = await ensurePostgres('hr-control-plane');
const cp = postgres(`postgres://postgres:${cpInfo.password}@127.0.0.1:${cpInfo.port}/postgres`, {
  max: 1,
  onnotice: () => {},
});

const tenants = args.all
  ? await cp`select slug from tenants where status = 'active' and db_ref like 'local-docker:%' order by slug`
  : args.slug
    ? await cp`select slug from tenants where slug = ${args.slug}`
    : [];

if (tenants.length === 0) {
  console.error('usage: --slug <slug> | --all');
  await cp.end();
  process.exit(1);
}

const version = gitVersion();
for (const { slug } of tenants) {
  const dbContainer = `hr-tenant-${slug}-db`;
  const appContainer = `hr-tenant-${slug}-app`;
  const dbSecret = loadSecret(dbContainer);
  if (!dbSecret) {
    console.error(`  ✗ ${slug}: no datastore secret, skipping`);
    continue;
  }
  // keep the currently published port if the container exists
  const current = dockerQuiet('port', appContainer, '3000/tcp');
  const port = current?.match(/:(\d+)\s*$/m)?.[1] ?? String(defaultPort(slug));
  dockerQuiet('rm', '-f', appContainer);
  docker(
    'run', '-d', '--name', appContainer, '--network', NETWORK,
    '-e', `TENANT_SLUG=${slug}`,
    '-e', `TENANT_DATABASE_URL=postgres://postgres:${dbSecret.password}@${dbContainer}:5432/postgres`,
    '-e', `CONTROL_PLANE_DATABASE_URL=postgres://postgres:${cpInfo.password}@hr-control-plane:5432/postgres`,
    '-p', `127.0.0.1:${port}:3000`,
    '--restart', 'unless-stopped',
    'hr-app:dev',
  );
  await cp`update tenants set deployed_version = ${version}, updated_at = now() where slug = ${slug}`;
  console.log(`  ✓ ${slug} → :${port} (v${version})`);
}

await cp.end();
console.log('redeploy complete');
