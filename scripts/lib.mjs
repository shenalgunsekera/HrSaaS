/** Shared helpers for provisioning scripts (local Docker datastore driver). */
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const secretsDir = path.join(repoRoot, '_secrets');
export const NETWORK = 'hr-net';
export const PG_IMAGE = 'postgres:17-alpine';

export function docker(...args) {
  return execFileSync('docker', args, { encoding: 'utf8' }).trim();
}

export function dockerQuiet(...args) {
  try {
    return execFileSync('docker', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

export function containerExists(name) {
  return dockerQuiet('inspect', '--format', '{{.State.Status}}', name) !== null;
}

export function ensureRunning(name) {
  const state = dockerQuiet('inspect', '--format', '{{.State.Status}}', name);
  if (state && state !== 'running') docker('start', name);
  return state !== null;
}

export function ensureNetwork() {
  if (!dockerQuiet('network', 'inspect', '--format', '{{.Id}}', NETWORK)) {
    docker('network', 'create', NETWORK);
  }
}

export function hostPort(container, containerPort = '5432/tcp') {
  const out = docker('port', container, containerPort);
  const m = out.match(/:(\d+)\s*$/m);
  if (!m) throw new Error(`cannot determine host port for ${container}`);
  return Number(m[1]);
}

export function loadSecret(name) {
  const f = path.join(secretsDir, `${name}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}

export function saveSecret(name, data) {
  mkdirSync(secretsDir, { recursive: true });
  writeFileSync(path.join(secretsDir, `${name}.json`), JSON.stringify(data, null, 2));
}

export function newPassword() {
  return randomBytes(18).toString('base64url');
}

/**
 * Ensure a dedicated Postgres container exists and is running.
 * Returns { password, port } (host-published port for scripts; containers on
 * hr-net reach it as {name}:5432).
 */
export async function ensurePostgres(name) {
  ensureNetwork();
  let secret = loadSecret(name);
  if (!containerExists(name)) {
    const password = secret?.password ?? newPassword();
    docker(
      'run', '-d', '--name', name, '--network', NETWORK,
      '-e', `POSTGRES_PASSWORD=${password}`,
      '-p', '127.0.0.1:0:5432',
      '-v', `${name}-data:/var/lib/postgresql/data`,
      '--restart', 'unless-stopped',
      PG_IMAGE,
    );
    secret = { password };
  } else {
    ensureRunning(name);
    if (!secret) throw new Error(`container ${name} exists but no secret stored`);
  }
  const port = hostPort(name);
  saveSecret(name, { ...secret, port });
  await waitForPg(name);
  return { password: secret.password, port };
}

export async function waitForPg(container, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      execFileSync('docker', ['exec', container, 'pg_isready', '-U', 'postgres'], {
        stdio: 'ignore',
      });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`postgres in ${container} not ready`);
}

/** Apply drizzle-generated .sql files in journal order, tracked idempotently. */
export async function applyMigrations(sql, migrationsDir, ledgerNote) {
  await sql`create table if not exists drizzle_migrations (
    tag text primary key, applied_at timestamptz not null default now())`;
  const journal = JSON.parse(
    readFileSync(path.join(migrationsDir, 'meta', '_journal.json'), 'utf8'),
  );
  const applied = [];
  for (const entry of journal.entries) {
    const tag = entry.tag;
    const [{ count }] = await sql`
      select count(*)::int as count from drizzle_migrations where tag = ${tag}`;
    if (count > 0) continue;
    const file = path.join(migrationsDir, `${tag}.sql`);
    const statements = readFileSync(file, 'utf8')
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) await sql.unsafe(stmt);
    await sql`insert into drizzle_migrations (tag) values (${tag})`;
    applied.push(tag);
  }
  if (applied.length) console.log(`  migrations applied (${ledgerNote}): ${applied.join(', ')}`);
  else console.log(`  migrations up to date (${ledgerNote})`);
  return applied;
}

export function gitVersion() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: repoRoot,
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'dev';
  }
}

export function tenantMigrationsDir() {
  const dir = path.join(repoRoot, 'packages', 'db', 'migrations', 'tenant');
  if (!existsSync(dir) || !readdirSync(dir).length) throw new Error('tenant migrations missing');
  return dir;
}

export function controlPlaneMigrationsDir() {
  return path.join(repoRoot, 'packages', 'db', 'migrations', 'control-plane');
}
