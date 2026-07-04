/**
 * The tenant factory — shared by the CLI (scripts/provision-tenant.mjs) and
 * the queue worker (services/provisioner). Local Docker datastore driver.
 *
 * Entry point: `executeRun(cp, cpInfo, runId)` — executes a provisioning_runs
 * row's pipeline. Idempotent: completed steps in the run's ledger are skipped,
 * so retrying a failed run resumes exactly where it stopped.
 */
import postgres from 'postgres';
import {
  containerExists,
  docker,
  ensurePostgres,
  ensureRunning,
  gitVersion,
  tenantMigrationsDir,
  applyMigrations,
  NETWORK,
} from './lib.mjs';

export function defaultPort(slug) {
  return 4100 + (Math.abs([...slug].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 400);
}

/** Brand hex → full CSS variable set (gradient endpoints derived simply). */
export function themeFromBrand(hex) {
  if (!hex) return null;
  const mix = (h, f, toWhite) => {
    const n = parseInt(h.slice(1), 16);
    const ch = (v) =>
      toWhite ? Math.min(255, Math.round(v + (255 - v) * f)) : Math.max(0, Math.round(v * (1 - f)));
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return `#${((ch(r) << 16) | (ch(g) << 8) | ch(b)).toString(16).padStart(6, '0')}`;
  };
  const lighten = (h, f) => mix(h, f, true);
  const darken = (h, f) => mix(h, f, false);
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

/**
 * Execute one provisioning run. `cp` is a postgres.js client on the control
 * plane; `cpInfo` its { password } (needed to inject the control-plane URL
 * into tenant app containers). Returns { ok, url? }.
 */
export async function executeRun(cp, cpInfo, runId, log = console.log) {
  const [run] = await cp`
    select r.id, r.kind, r.steps, r.params, t.id as tenant_id, t.slug, t.display_name,
           t.legal_name, t.tier, t.theme
    from provisioning_runs r join tenants t on t.id = r.tenant_id
    where r.id = ${runId}`;
  if (!run) throw new Error(`run ${runId} not found`);
  if (run.kind !== 'provision') throw new Error(`unsupported run kind ${run.kind}`);

  const slug = run.slug;
  const params = run.params ?? {};
  const appPort = Number(params.port ?? defaultPort(slug));
  const adminEmail = params.adminEmail ?? `admin@${slug}.example`;
  const dbContainer = `hr-tenant-${slug}-db`;
  const appContainer = `hr-tenant-${slug}-app`;
  const hostname = `${slug}.localhost`;
  const CP = 'hr-control-plane';

  await cp`update provisioning_runs set status = 'running', started_at = coalesce(started_at, now())
    where id = ${run.id}`;

  const steps = run.steps ?? {};
  let tdb = null;
  let tdbInfo = null;

  const step = async (key, fn) => {
    if (steps[key]?.status === 'done') {
      log(`  ✓ ${key} (already done)`);
      return;
    }
    try {
      await fn();
      steps[key] = { status: 'done', finishedAt: new Date().toISOString() };
      log(`  ✓ ${key}`);
    } catch (e) {
      steps[key] = { status: 'failed', error: String(e?.message ?? e) };
      await cp`update provisioning_runs set steps = ${steps}, status = 'failed',
        error = ${String(e?.message ?? e)} where id = ${run.id}`;
      log(`  ✗ ${key}: ${e?.message ?? e}`);
      throw e;
    }
    await cp`update provisioning_runs set steps = ${steps} where id = ${run.id}`;
  };

  try {
    await step('create-datastore', async () => {
      tdbInfo = await ensurePostgres(dbContainer);
    });
    if (!tdbInfo) tdbInfo = await ensurePostgres(dbContainer);
    tdb = postgres(
      `postgres://postgres:${tdbInfo.password}@127.0.0.1:${tdbInfo.port}/postgres`,
      { max: 1, onnotice: () => {} },
    );

    await step('run-migrations', async () => {
      const applied = await applyMigrations(tdb, tenantMigrationsDir(), `tenant ${slug}`);
      for (const tag of applied) {
        await cp`insert into tenant_migrations (tenant_id, migration_tag, succeeded)
          values (${run.tenant_id}, ${tag}, true) on conflict do nothing`;
      }
    });

    await step('seed-reference-data', async () => {
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
          values (${run.tenant_id}, ${hostname}, 'platform_subdomain', 'active', true, now())`;
      }
    });

    await step('issue-certificate', async () => {
      /* local driver: no TLS; production driver = ACME + renewal monitoring */
    });

    await step('set-entitlements', async () => {
      await cp`update tenants set tier = ${run.tier} where id = ${run.tenant_id}`;
    });

    await step('create-admin-user', async () => {
      await tdb`insert into tenant_members (email, full_name, role)
        values (${adminEmail}, ${'Administrator'}, 'tenant-admin')
        on conflict (email) do nothing`;
      const metaRows = {
        slug,
        display_name: run.display_name,
        provisioned_at: new Date().toISOString(),
        driver: 'local-docker',
      };
      for (const [key, value] of Object.entries(metaRows)) {
        await tdb`insert into tenant_meta (key, value) values (${key}, ${tdb.json(value)})
          on conflict (key) do update set value = excluded.value, updated_at = now()`;
      }
    });

    await step('apply-theme', async () => {
      /* theme already stored on the tenant row at create/update time */
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
        where id = ${run.tenant_id}`;
      await cp`insert into control_plane_audit_log (actor, action, tenant_id, detail)
        values ('factory', 'tenant.provisioned', ${run.tenant_id}, ${cp.json({ driver: 'local-docker', appPort })})`;
    });

    await cp`update provisioning_runs set status = 'complete',
      finished_at = coalesce(finished_at, now()), steps = ${steps}
      where id = ${run.id} and status <> 'complete'`;

    return { ok: true, url: `http://localhost:${appPort}/status`, appPort };
  } finally {
    if (tdb) await tdb.end({ timeout: 2 });
  }
}

/** Upsert the tenant row and enqueue a provision run. Returns { tenantId, runId }. */
export async function enqueueProvision(cp, { slug, name, tier, brand, port, adminEmail }) {
  const theme = themeFromBrand(brand ?? null);
  const [tenant] = await cp`
    insert into tenants (slug, legal_name, display_name, tier, max_tier_held, status, theme)
    values (${slug}, ${name ?? slug}, ${name ?? slug}, ${tier}, ${tier}, 'provisioning', ${theme})
    on conflict (slug) do update set
      tier = excluded.tier,
      max_tier_held = case when tenants.max_tier_held >= excluded.tier then tenants.max_tier_held else excluded.tier end,
      theme = coalesce(excluded.theme, tenants.theme),
      status = case when tenants.status = 'active' then 'active'::tenant_status else 'provisioning'::tenant_status end,
      updated_at = now()
    returning id`;

  // Reuse an unfinished run if one exists (resume), else enqueue a new one.
  const [existing] = await cp`
    select id from provisioning_runs
    where tenant_id = ${tenant.id} and kind = 'provision' and status in ('queued','running','failed')
    order by created_at desc limit 1`;
  if (existing) {
    await cp`update provisioning_runs set status = 'queued' where id = ${existing.id}`;
    return { tenantId: tenant.id, runId: existing.id };
  }
  const [runRow] = await cp`
    insert into provisioning_runs (tenant_id, kind, status, params)
    values (${tenant.id}, 'provision', 'queued', ${cp.json({ port: port ?? null, adminEmail: adminEmail ?? null })})
    returning id`;
  return { tenantId: tenant.id, runId: runRow.id };
}
