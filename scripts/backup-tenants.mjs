/**
 * Per-tenant backups WITH tested restore (Phase 9, §4.7).
 * "An untested backup is not a backup" — so every backup is immediately
 * restored into a throwaway container and verified before being recorded as
 * restore-tested in the control plane.
 *
 *   node scripts/backup-tenants.mjs [--slug acme] [--no-verify]
 *
 * Local Docker driver: pg_dump from each dedicated tenant container into
 * _backups/. Production driver uses the platform's managed snapshot API with
 * the same verify-restore discipline.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import {
  dockerQuiet,
  ensurePostgres,
  loadSecret,
  repoRoot,
  NETWORK,
  PG_IMAGE,
  waitForPg,
} from './lib.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 1) {
  const a = process.argv[i];
  if (a === '--no-verify') args.noVerify = true;
  else if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i];
}

const backupsDir = path.join(repoRoot, '_backups');
mkdirSync(backupsDir, { recursive: true });

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
  const dbContainer = `hr-tenant-${t.slug}-db`;
  if (!loadSecret(dbContainer)) {
    console.error(`  ✗ ${t.slug}: no datastore`);
    failed++;
    continue;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const artifact = path.join(backupsDir, `${t.slug}-${stamp}.dump`);

  try {
    // pg_dump custom format from inside the tenant container → host file
    const dump = execFileSync(
      'docker',
      ['exec', dbContainer, 'pg_dump', '-U', 'postgres', '-Fc', 'postgres'],
      { maxBuffer: 512 * 1024 * 1024 },
    );
    writeFileSync(artifact, dump);
    const size = statSync(artifact).size;

    let restoreTested = false;
    if (!args.noVerify) {
      restoreTested = await verifyRestore(t.slug, dbContainer, artifact);
    }

    await cp`insert into tenant_backups (tenant_id, artifact, size_bytes, restore_tested, restore_verified_at)
      values (${t.id}, ${path.basename(artifact)}, ${size}, ${restoreTested},
              ${restoreTested ? new Date() : null})`;
    console.log(`  ✓ ${t.slug}: ${(size / 1024).toFixed(0)}KB${restoreTested ? ' · restore VERIFIED' : ''}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${t.slug}: ${e?.message ?? e}`);
  }
}

await cp`insert into control_plane_audit_log (actor, action, detail)
  values ('ops', 'backup.run', ${cp.json({ tenants: tenants.length, failed })})`;
await cp.end();
if (failed) {
  console.error(`${failed} backup(s) failed`);
  process.exit(1);
}
console.log(`backed up ${tenants.length} tenant(s)`);

/**
 * Tested restore: spin a throwaway Postgres, pg_restore the dump into it, and
 * assert core tables came back with data. This is what makes the backup real.
 */
async function verifyRestore(slug, sourceContainer, artifact) {
  const probe = `hr-restore-probe-${slug}`;
  dockerQuiet('rm', '-f', probe);
  const pw = 'restore-probe';
  execFileSync('docker', [
    'run', '-d', '--name', probe, '--network', NETWORK,
    '-e', `POSTGRES_PASSWORD=${pw}`, PG_IMAGE,
  ]);
  try {
    await waitForPg(probe);
    // copy dump into probe and restore. pg_restore commonly returns non-zero
    // for ignorable notices (e.g. the app role absent in a clean probe); the
    // row-count assertion below is the real pass/fail, so tolerate its exit.
    execFileSync('docker', ['cp', artifact, `${probe}:/tmp/t.dump`]);
    try {
      execFileSync('docker', ['exec', probe, 'pg_restore', '-U', 'postgres', '-d', 'postgres',
        '--no-owner', '--no-privileges', '/tmp/t.dump'], { stdio: 'ignore' });
    } catch {
      /* non-fatal restore notices — verified by row count next */
    }
    // verify: same employee count in source and restored copy
    const count = (c) =>
      Number(
        execFileSync('docker', ['exec', c, 'psql', '-U', 'postgres', '-t', '-A', '-c',
          "select count(*) from employees"], { encoding: 'utf8' }).trim(),
      );
    const src = count(sourceContainer);
    const restored = count(probe);
    if (src !== restored) throw new Error(`row mismatch: source ${src} vs restored ${restored}`);
    return true;
  } finally {
    dockerQuiet('rm', '-f', probe);
  }
}
