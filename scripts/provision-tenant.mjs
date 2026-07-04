/**
 * Tenant factory — local Docker driver (ADR-0008 dev mode, ADR-0009).
 *
 *   node scripts/provision-tenant.mjs --slug acme --name "Acme Holdings" \
 *     --tier L3 [--brand "#0D9488"] [--port 4101] [--admin admin@acme.lk]
 *
 * One command → dedicated database + migrated schema + seeded statutory data
 * + control-plane registration + entitlements + admin user + theme + a live,
 * reachable app container. Idempotent: re-running heals a failed run; each
 * step is recorded in provisioning_runs. Zero manual steps (non-negotiable #7).
 */
import postgres from 'postgres';
import {
  applyMigrations,
  containerExists,
  controlPlaneMigrationsDir,
  docker,
  dockerQuiet,
  ensurePostgres,
  ensureRunning,
  gitVersion,
  tenantMigrationsDir,
  NETWORK,
} from './lib.mjs';

/* ── args ── */
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
}
const slug = args.slug;
const tier = args.tier ?? 'L1';
const name = args.name ?? slug;
const brand = args.brand ?? null;
const appPort = Number(args.port ?? 4100 + (Math.abs([...(slug ?? '')].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 400));
const adminEmail = args.admin ?? `admin@${slug}.example`;

if (!slug || !/^[a-z][a-z0-9-]{1,30}$/.test(slug)) {
  console.error('usage: --slug <kebab-slug> [--name "Legal Name"] [--tier L1..L5] [--brand "#hex"] [--port N]');
  process.exit(1);
}
if (!['L1', 'L2', 'L3', 'L4', 'L5'].includes(tier)) {
  console.error(`invalid tier ${tier}`);
  process.exit(1);
}

/** Brand hex → full CSS variable set (gradient endpoints derived simply). */
function themeFromBrand(hex) {
  if (!hex) return null;
  const lighten = (h, f) => {
    const n = parseInt(h.slice(1), 16);
    const ch = (v) => Math.min(255, Math.round(v + (255 - v) * f));
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return `#${((ch(r) << 16) | (ch(g) << 8) | ch(b)).toString(16).padStart(6, '0')}`;
  };
  const darken = (h, f) => {
    const n = parseInt(h.slice(1), 16);
    const ch = (v) => Math.max(0, Math.round(v * (1 - f)));
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return `#${((ch(r) << 16) | (ch(g) << 8) | ch(b)).toString(16).padStart(6, '0')}`;
  };
  return {
    colors: {
      '--brand': hex,
      '--brand-light': lighten(hex, 0.45),
      '--brand-dark': darken(hex, 0.35),
      '--brand-50': lighten(hex, 0.93),
      '--brand-100': lighten(hex, 0.85),
      '--brand-600': darken(hex, 0.12),
      '--brand-gradient-from': lighten(hex, 0.45),
      '--brand-gradient-via': hex,
      '--brand-gradient-to': darken(hex, 0.25),
    },
  };
}

const CP = 'hr-control-plane';
const dbContainer = `hr-tenant-${slug}-db`;
const appContainer = `hr-tenant-${slug}-app`;
const hostname = `${slug}.localhost`;

console.log(`\n▶ provisioning tenant '${slug}' (tier ${tier})`);

/* ── control plane up + migrated ── */
const cpInfo = await ensurePostgres(CP);
const cp = postgres(`postgres://postgres:${cpInfo.password}@127.0.0.1:${cpInfo.port}/postgres`, { max: 1, onnotice: () => {} });
await applyMigrations(cp, controlPlaneMigrationsDir(), 'control-plane');

/* ── tenant registry row (upsert) ── */
const theme = themeFromBrand(brand);
const [tenant] = await cp`
  insert into tenants (slug, legal_name, display_name, tier, max_tier_held, status, theme)
  values (${slug}, ${name}, ${name}, ${tier}, ${tier}, 'provisioning', ${theme})
  on conflict (slug) do update set
    tier = excluded.tier,
    max_tier_held = case when tenants.max_tier_held >= excluded.tier then tenants.max_tier_held else excluded.tier end,
    theme = coalesce(excluded.theme, tenants.theme),
    updated_at = now()
  returning id, slug`;

/* ── provisioning run (resume prior failed run's step ledger) ── */
const [prior] = await cp`
  select id, steps from provisioning_runs
  where tenant_id = ${tenant.id} and kind = 'provision'
  order by created_at desc limit 1`;
let steps = prior?.steps ?? {};
const [run] = prior && Object.values(prior.steps ?? {}).some((s) => s.status !== 'done')
  ? [prior]
  : await cp`
      insert into provisioning_runs (tenant_id, kind, status, steps, started_at)
      values (${tenant.id}, 'provision', 'running', ${steps}, now())
      returning id, steps`;
steps = run.steps ?? steps;

async function step(key, fn) {
  if (steps[key]?.status === 'done') {
    console.log(`  ✓ ${key} (already done)`);
    return;
  }
  process.stdout.write(`  … ${key}`);
  try {
    await fn();
    steps[key] = { status: 'done', finishedAt: new Date().toISOString() };
    console.log(`\r  ✓ ${key}          `);
  } catch (e) {
    steps[key] = { status: 'failed', error: String(e?.message ?? e) };
    await cp`update provisioning_runs set steps = ${steps}, status = 'failed', error = ${String(e?.message ?? e)} where id = ${run.id}`;
    console.error(`\r  ✗ ${key}: ${e?.message ?? e}`);
    await cp.end();
    process.exit(1);
  }
  await cp`update provisioning_runs set steps = ${steps} where id = ${run.id}`;
}

let tdbInfo;
let tdb;

await step('create-datastore', async () => {
  tdbInfo = await ensurePostgres(dbContainer);
});
if (!tdbInfo) tdbInfo = await ensurePostgres(dbContainer);
tdb = postgres(`postgres://postgres:${tdbInfo.password}@127.0.0.1:${tdbInfo.port}/postgres`, { max: 1, onnotice: () => {} });

await step('run-migrations', async () => {
  const applied = await applyMigrations(tdb, tenantMigrationsDir(), `tenant ${slug}`);
  for (const tag of applied) {
    await cp`insert into tenant_migrations (tenant_id, migration_tag, succeeded)
      values (${tenant.id}, ${tag}, true) on conflict do nothing`;
  }
});

await step('seed-reference-data', async () => {
  // Sri Lanka statutory rates. APIT brackets are PLACEHOLDERS pending the
  // mandatory Phase 6 verification against IRD sources (ADR-0007 §7).
  const rates = [
    { kind: 'epf_employee', rate: '8.000', params: null },
    { kind: 'epf_employer', rate: '12.000', params: null },
    { kind: 'etf_employer', rate: '3.000', params: null },
    { kind: 'gratuity', rate: null, params: { halfMonthPerYear: true, minServiceYears: 5 } },
  ];
  for (const r of rates) {
    const [{ count }] = await tdb`select count(*)::int as count from statutory_rates
      where kind = ${r.kind} and effective_from = '2026-01-01'`;
    if (count === 0) {
      await tdb`insert into statutory_rates (kind, rate_percent, params, effective_from, source)
        values (${r.kind}, ${r.rate}, ${r.params}, '2026-01-01',
                'UNVERIFIED SEED — confirm against authoritative source before payroll (ADR-0007 §7)')`;
    }
  }
  const [{ count: tt }] = await tdb`select count(*)::int as count from tax_tables where name = 'APIT'`;
  if (tt === 0) {
    await tdb`insert into tax_tables (name, brackets, reliefs, effective_from, source)
      values ('APIT',
        ${tdb.json([
          { upTo: 150000, ratePercent: 0 },
          { upTo: 233333, ratePercent: 6 },
          { upTo: 275000, ratePercent: 18 },
          { upTo: 316667, ratePercent: 24 },
          { upTo: 358333, ratePercent: 30 },
          { upTo: null, ratePercent: 36 },
        ])},
        ${tdb.json({ personalReliefMonthly: 150000 })},
        '2026-01-01',
        'UNVERIFIED SEED — confirm against IRD before payroll (ADR-0007 §7)')`;
  }
  await tdb`insert into holiday_calendars (country, year, holidays)
    values ('LK', 2026, ${tdb.json([
      { date: '2026-02-04', name: 'Independence Day', type: 'public' },
      { date: '2026-04-13', name: 'Sinhala & Tamil New Year Eve', type: 'public' },
      { date: '2026-04-14', name: 'Sinhala & Tamil New Year', type: 'public' },
      { date: '2026-05-01', name: 'May Day', type: 'public' },
      { date: '2026-12-25', name: 'Christmas Day', type: 'public' },
    ])})
    on conflict do nothing`;
});

await step('configure-domain', async () => {
  const [{ count }] = await cp`select count(*)::int as count from tenant_domains
    where hostname = ${hostname}`;
  if (count === 0) {
    await cp`insert into tenant_domains (tenant_id, hostname, type, status, is_primary, last_verified_at)
      values (${tenant.id}, ${hostname}, 'platform_subdomain', 'active', true, now())`;
  }
});

await step('issue-certificate', async () => {
  /* local driver: no TLS; production driver issues via ACME and monitors renewal */
});

await step('set-entitlements', async () => {
  await cp`update tenants set tier = ${tier} where id = ${tenant.id}`;
});

await step('create-admin-user', async () => {
  await tdb`insert into tenant_members (email, full_name, role)
    values (${adminEmail}, ${'Administrator'}, 'tenant-admin')
    on conflict (email) do nothing`;
  const metaRows = {
    slug,
    display_name: name,
    provisioned_at: new Date().toISOString(),
    driver: 'local-docker',
  };
  for (const [key, value] of Object.entries(metaRows)) {
    await tdb`insert into tenant_meta (key, value) values (${key}, ${tdb.json(value)})
      on conflict (key) do update set value = excluded.value, updated_at = now()`;
  }
});

await step('apply-theme', async () => {
  if (theme) await cp`update tenants set theme = ${theme} where id = ${tenant.id}`;
});

await step('start-app', async () => {
  if (!containerExists(appContainer)) {
    docker(
      'run', '-d', '--name', appContainer, '--network', NETWORK,
      '-e', `TENANT_SLUG=${slug}`,
      '-e', `TENANT_DATABASE_URL=postgres://postgres:${tdbInfo.password}@${dbContainer}:5432/postgres`,
      '-e', `CONTROL_PLANE_DATABASE_URL=postgres://postgres:${cpInfo.password}@${CP}:5432/postgres`,
      '-p', `127.0.0.1:${appPort}:3000`,
      '--restart', 'unless-stopped',
      'hr-app:dev',
    );
  } else {
    ensureRunning(appContainer);
  }
});

await step('mark-complete', async () => {
  await cp`update tenants set
      status = 'active',
      db_ref = ${`local-docker:${dbContainer}`},
      deployed_version = ${gitVersion()},
      updated_at = now()
    where id = ${tenant.id}`;
  await cp`update provisioning_runs set status = 'complete', finished_at = now(), steps = ${steps}
    where id = ${run.id}`;
  await cp`insert into control_plane_audit_log (actor, action, tenant_id, detail)
    values ('factory', 'tenant.provisioned', ${tenant.id}, ${cp.json({ driver: 'local-docker', appPort })})`;
});

// A re-run whose steps were all already done skips mark-complete's fn;
// make sure the run row itself never dangles in 'running'.
await cp`update provisioning_runs set status = 'complete', finished_at = coalesce(finished_at, now()), steps = ${steps}
  where id = ${run.id} and status <> 'complete'`;

const publishedPort = dockerQuiet('port', appContainer, '3000/tcp')?.match(/:(\d+)\s*$/m)?.[1] ?? appPort;
console.log(`\n✔ tenant '${slug}' live → http://localhost:${publishedPort}/status  (domain record: ${hostname})`);
console.log(`  db: ${dbContainer} · app: ${appContainer} · admin: ${adminEmail}\n`);

await tdb.end();
await cp.end();
