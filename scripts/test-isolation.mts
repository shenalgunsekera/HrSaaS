/**
 * Cross-tenant isolation tests (Phase 3 DoD; runs in CI and locally).
 *
 *   npx tsx scripts/test-isolation.mts
 *
 * With dedicated DBs the top risk is the ROUTING layer resolving a user to
 * the wrong tenant's database — so that's what these tests attack:
 *  1. hostname → tenant resolution returns exactly the right dedicated DB
 *  2. unknown/inactive hostnames resolve to NOTHING (no fallthrough)
 *  3. each dedicated DB contains only its own tenant's data
 *  4. RLS posture: enabled on every tenant table; an unprivileged role is
 *     denied by default
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import postgres from 'postgres';
import { createTenantResolver } from '@hr/tenant-context';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function secret(name: string) {
  return JSON.parse(
    readFileSync(path.join(repoRoot, '_secrets', `${name}.json`), 'utf8'),
  ) as { password: string; port: number };
}

const cpSecret = secret('hr-control-plane');
const controlPlaneUrl = `postgres://postgres:${cpSecret.password}@127.0.0.1:${cpSecret.port}/postgres`;

const resolver = createTenantResolver({
  controlPlaneUrl,
  cacheTtlMs: 0,
  secretResolver: async (dbRef) => {
    const m = /^local-docker:(.+)$/.exec(dbRef);
    if (!m) return null;
    const s = secret(m[1]!);
    return `postgres://postgres:${s.password}@127.0.0.1:${s.port}/postgres`;
  },
});

let failures = 0;
async function check(label: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
  } catch (e) {
    failures++;
    console.error(`  ✗ ${label}: ${e instanceof Error ? e.message : e}`);
  }
}

console.log('cross-tenant isolation tests');

await check('acme.localhost resolves to acme and ONLY acme', async () => {
  const ctx = await resolver.byHostname('acme.localhost');
  assert.ok(ctx, 'acme must resolve');
  assert.equal(ctx.slug, 'acme');
  assert.match(ctx.dbRef, /hr-tenant-acme-db/);
});

await check('globex.localhost resolves to globex and ONLY globex', async () => {
  const ctx = await resolver.byHostname('globex.localhost');
  assert.ok(ctx, 'globex must resolve');
  assert.equal(ctx.slug, 'globex');
  assert.match(ctx.dbRef, /hr-tenant-globex-db/);
});

await check('unknown hostname resolves to NOTHING (no fallthrough)', async () => {
  assert.equal(await resolver.byHostname('evil.localhost'), null);
  assert.equal(await resolver.byHostname('acme.evil.example'), null);
  assert.equal(await resolver.byHostname(''), null);
});

await check('port suffix and case are normalized, never confused', async () => {
  const ctx = await resolver.byHostname('ACME.localhost:4101');
  assert.equal(ctx?.slug, 'acme');
});

await check("each dedicated DB holds only its own tenant's data", async () => {
  for (const [slug, other] of [
    ['acme', 'globex'],
    ['globex', 'acme'],
  ] as const) {
    const ctx = await resolver.byHostname(`${slug}.localhost`);
    assert.ok(ctx);
    const db = postgres(ctx.dbUrl, { max: 1, onnotice: () => {} });
    try {
      const [meta] = await db<{ value: string }[]>`
        select value::text as value from tenant_meta where key = 'slug'`;
      assert.equal(JSON.parse(meta!.value), slug, `tenant_meta.slug must be ${slug}`);
      const [{ count }] = await db<[{ count: number }]>`
        select count(*)::int as count from tenant_members where email like ${'%@' + other + '.%'}`;
      assert.equal(count, 0, `${slug} DB must contain no ${other} members`);
    } finally {
      await db.end({ timeout: 2 });
    }
  }
});

await check('RLS enabled on every tenant table; unprivileged role denied', async () => {
  const ctx = await resolver.byHostname('acme.localhost');
  assert.ok(ctx);
  const db = postgres(ctx.dbUrl, { max: 1, onnotice: () => {} });
  try {
    const tables = await db<{ relname: string; relrowsecurity: boolean }[]>`
      select relname, relrowsecurity from pg_class
      where relkind = 'r' and relnamespace = 'public'::regnamespace
        and relname not in ('drizzle_migrations')`;
    assert.ok(tables.length >= 6, 'expected tenant tables present');
    for (const t of tables) {
      assert.ok(t.relrowsecurity, `RLS must be enabled on ${t.relname}`);
    }
    await db.unsafe(`drop role if exists rls_probe`);
    await db.unsafe(`create role rls_probe login password 'probe-only'`);
    try {
      const probe = postgres(ctx.dbUrl.replace(/postgres:\/\/postgres:[^@]+@/, `postgres://rls_probe:probe-only@`), {
        max: 1,
        onnotice: () => {},
      });
      try {
        await assert.rejects(
          probe`select * from tenant_members`,
          /permission denied|row-level/i,
          'unprivileged role must be denied',
        );
      } finally {
        await probe.end({ timeout: 2 });
      }
    } finally {
      await db.unsafe(`drop role if exists rls_probe`);
    }
  } finally {
    await db.end({ timeout: 2 });
  }
});

await resolver.end();
if (failures > 0) {
  console.error(`\n${failures} isolation test(s) FAILED`);
  process.exit(1);
}
console.log('\nall isolation tests passed');
