/**
 * Fastest Supabase path: migrate + seed a control-plane project and ONE
 * tenant project, and register the tenant so it resolves. No Docker, no
 * Management API — you create the two projects manually, this wires them.
 *
 *   CONTROL_PLANE_DATABASE_URL=postgres://...pooler:5432/postgres \
 *   TENANT_DATABASE_URL=postgres://...tenant.../postgres \
 *   node scripts/setup-supabase.mjs --slug demo --name "Demo Company" --tier L3 [--brand "#0D9488"]
 *
 * Use the DIRECT connection string (port 5432) here — migrations need session
 * mode. The apps use the TRANSACTION POOLER string (port 6543) at runtime.
 * Idempotent: safe to re-run.
 */
import postgres from 'postgres';
import {
  applyMigrations,
  controlPlaneMigrationsDir,
  tenantMigrationsDir,
} from './lib.mjs';
import { themeFromBrand } from './factory.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i]?.replace(/^--/, '')] = process.argv[i + 1];
const { slug, name, tier = 'L1', brand } = args;

const cpUrl = process.env.CONTROL_PLANE_DATABASE_URL;
const tdbUrl = process.env.TENANT_DATABASE_URL;
if (!slug || !/^[a-z][a-z0-9-]{1,30}$/.test(slug)) { console.error('need --slug <kebab>'); process.exit(1); }
if (!cpUrl || !tdbUrl) { console.error('set CONTROL_PLANE_DATABASE_URL and TENANT_DATABASE_URL env'); process.exit(1); }
if (!['L1', 'L2', 'L3', 'L4', 'L5'].includes(tier)) { console.error('bad --tier'); process.exit(1); }

const cp = postgres(cpUrl, { max: 1, onnotice: () => {}, ssl: 'require' });
const tdb = postgres(tdbUrl, { max: 1, onnotice: () => {}, ssl: 'require' });

try {
  console.log('▶ control plane: migrating…');
  await applyMigrations(cp, controlPlaneMigrationsDir(), 'control-plane');

  console.log('▶ tenant DB: migrating…');
  await applyMigrations(tdb, tenantMigrationsDir(), `tenant ${slug}`);

  console.log('▶ tenant DB: app role + RLS + seeds…');
  // The tenant migrations GRANT to hr_app; ensure the role exists (Supabase
  // projects don't have it by default until the RLS migration's DO block runs,
  // which it does — but make idempotent for safety).
  await tdb`insert into statutory_rates (kind, rate_percent, effective_from, source)
    select * from (values
      ('epf_employee', 8.000, date '2026-01-01', 'VERIFIED 2026-07-05 docs/STATUTORY.md'),
      ('epf_employer', 12.000, date '2026-01-01', 'VERIFIED 2026-07-05 docs/STATUTORY.md'),
      ('etf_employer', 3.000, date '2026-01-01', 'VERIFIED 2026-07-05 docs/STATUTORY.md')
    ) v(kind, rate_percent, effective_from, source)
    where not exists (select 1 from statutory_rates)`;
  await tdb`insert into statutory_rates (kind, params, effective_from, source)
    select 'gratuity', '{"halfMonthPerYear":true,"minServiceYears":5}'::jsonb, date '2026-01-01', 'VERIFIED Gratuity Act 12/1983'
    where not exists (select 1 from statutory_rates where kind='gratuity')`;
  await tdb`insert into tax_tables (name, brackets, reliefs, effective_from, source)
    select 'APIT',
      '[{"upTo":150000,"ratePercent":0},{"upTo":233333,"ratePercent":6},{"upTo":275000,"ratePercent":18},{"upTo":316667,"ratePercent":24},{"upTo":358333,"ratePercent":30},{"upTo":null,"ratePercent":36}]'::jsonb,
      '{"personalReliefMonthly":150000}'::jsonb, date '2026-01-01', 'VERIFIED IRD 2025/26'
    where not exists (select 1 from tax_tables where name='APIT')`;
  await tdb`insert into tenant_meta (key, value) values ('slug', to_jsonb(${slug}::text))
    on conflict (key) do update set value = excluded.value`;
  await tdb`insert into tenant_members (email, full_name, role)
    values (${`admin@${slug}.example`}, 'Administrator', 'tenant-admin')
    on conflict (email) do nothing`;

  console.log('▶ control plane: registering tenant + domain…');
  const theme = themeFromBrand(brand ?? null);
  const [t] = await cp`
    insert into tenants (slug, legal_name, display_name, tier, max_tier_held, status, theme, db_ref)
    values (${slug}, ${name ?? slug}, ${name ?? slug}, ${tier}, ${tier}, 'active', ${theme}, ${`supabase:${slug}`})
    on conflict (slug) do update set tier = excluded.tier, status = 'active',
      theme = coalesce(excluded.theme, tenants.theme), db_ref = excluded.db_ref
    returning id`;
  await cp`insert into tenant_domains (tenant_id, hostname, type, status, is_primary, last_verified_at)
    values (${t.id}, ${`${slug}.localhost`}, 'platform_subdomain', 'active', true, now())
    on conflict do nothing`;

  console.log(`\n✔ Supabase wired. Tenant '${slug}' (${tier}) is active.`);
  console.log('  Set these on the tenant-app Vercel project:');
  console.log(`    TENANT_SLUG=${slug}`);
  console.log('    TENANT_DATABASE_URL=<tenant POOLER url, port 6543>');
  console.log('    CONTROL_PLANE_DATABASE_URL=<control-plane POOLER url, port 6543>\n');
} finally {
  await cp.end({ timeout: 5 });
  await tdb.end({ timeout: 5 });
}
