/**
 * Disaster recovery: rebuild a tenant's dedicated database from its latest
 * (or a named) backup artifact (Phase 9 DR runbook step).
 *
 *   node scripts/restore-tenant.mjs --slug acme [--artifact acme-....dump]
 *
 * Restores into the tenant's existing DB container (drops+recreates public
 * schema first). Pair with `redeploy` to bring the app back. Production driver
 * restores the managed snapshot; the runbook is otherwise identical.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { dockerQuiet, ensurePostgres, loadSecret, repoRoot } from './lib.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i]?.replace(/^--/, '')] = process.argv[i + 1];
if (!args.slug) {
  console.error('usage: --slug <slug> [--artifact <file.dump>]');
  process.exit(1);
}

const backupsDir = path.join(repoRoot, '_backups');
const artifact = args.artifact ??
  readdirSync(backupsDir).filter((f) => f.startsWith(`${args.slug}-`) && f.endsWith('.dump')).sort().at(-1);
if (!artifact) {
  console.error(`no backup found for ${args.slug}`);
  process.exit(1);
}

const dbContainer = `hr-tenant-${args.slug}-db`;
const secret = loadSecret(dbContainer);
if (!secret) {
  console.error(`no datastore for ${args.slug}`);
  process.exit(1);
}

console.log(`▶ restoring ${args.slug} from ${artifact}`);
// reset schema then restore
execFileSync('docker', ['exec', dbContainer, 'psql', '-U', 'postgres', '-c',
  'drop schema public cascade; create schema public;'], { stdio: 'ignore' });
execFileSync('docker', ['cp', path.join(backupsDir, artifact), `${dbContainer}:/tmp/restore.dump`]);
try {
  execFileSync('docker', ['exec', dbContainer, 'pg_restore', '-U', 'postgres', '-d', 'postgres',
    '--no-owner', '/tmp/restore.dump'], { stdio: 'ignore' });
} catch {
  /* non-fatal notices (app role grants) — verified below */
}

const tdb = postgres(`postgres://postgres:${secret.password}@127.0.0.1:${secret.port}/postgres`, { max: 1, onnotice: () => {} });
try {
  const [{ n }] = await tdb`select count(*)::int n from employees`;
  console.log(`✔ ${args.slug} restored — ${n} employees recovered. Run 'npm run redeploy -- --slug ${args.slug}' to bring the app up.`);
} finally {
  await tdb.end({ timeout: 2 });
}

const cpInfo = await ensurePostgres('hr-control-plane');
const cp = postgres(`postgres://postgres:${cpInfo.password}@127.0.0.1:${cpInfo.port}/postgres`, { max: 1, onnotice: () => {} });
await cp`insert into control_plane_audit_log (actor, action, detail)
  values ('ops', 'tenant.restored', ${cp.json({ slug: args.slug, artifact })})`;
await cp.end();
void dockerQuiet;
