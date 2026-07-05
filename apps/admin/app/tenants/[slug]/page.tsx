import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MODULES, resolveEntitlements, TIERS, type Tier } from '@hr/entitlements';
import { cp } from '../../../lib/cp';

export const dynamic = 'force-dynamic';

interface TenantRow {
  id: string;
  slug: string;
  display_name: string;
  legal_name: string;
  tier: Tier;
  max_tier_held: Tier;
  status: string;
  billing_status: string;
  db_ref: string | null;
  deployed_version: string | null;
  retention_days: number;
  theme: { colors?: Record<string, string> } | null;
  created_at: string;
}

interface RunRow {
  id: string;
  kind: string;
  status: string;
  attempt: number;
  error: string | null;
  created_at: string;
  steps: Record<string, { status: string; error?: string }>;
}

export default async function TenantDetail(ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const sql = cp();
  const [tenant] = await sql<TenantRow[]>`select * from tenants where slug = ${slug}`;
  if (!tenant) notFound();

  const domains = await sql<{ hostname: string; type: string; status: string }[]>`
    select hostname, type, status from tenant_domains where tenant_id = ${tenant.id}`;
  const runs = await sql<RunRow[]>`
    select id, kind, status, attempt, error, created_at, steps
    from provisioning_runs where tenant_id = ${tenant.id}
    order by created_at desc limit 5`;

  const entitlements = resolveEntitlements({
    tier: tenant.tier,
    maxTierHeld: tenant.max_tier_held,
  });
  const brand = tenant.theme?.colors?.['--brand'];
  const logoUrl = (tenant.theme as { logoUrl?: string } | null)?.logoUrl;

  return (
    <main className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <Link href="/" className="font-body text-xs font-semibold tracking-wider text-brand uppercase">
          ← All tenants
        </Link>
        <div className="flex flex-wrap items-center gap-5 mt-4 mb-2">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={`${tenant.display_name} logo`}
              className="h-16 w-16 object-contain border border-line bg-ink p-1"
            />
          )}
          <h1 className="text-3xl font-bold tracking-tight text-chalk">
            {tenant.display_name}
          </h1>
          {brand && (
            <span
              className="inline-block w-8 h-8 border border-line align-middle"
              style={{ background: brand }}
              title={`brand ${brand}`}
            />
          )}
        </div>
        <p className="font-heading italic text-lg text-mute-1 mb-10">
          {tenant.slug} · {tenant.status} · billing {tenant.billing_status} ·{' '}
          {tenant.db_ref ?? 'no datastore yet'} · v{tenant.deployed_version ?? '—'} · retention{' '}
          {tenant.retention_days}d
        </p>

        {/* tier flip: pure entitlement change, applies live */}
        <section className="rounded-lg border border-line bg-surface p-5 mb-10">
          <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
            Tier — currently {tenant.tier} (max held {tenant.max_tier_held})
          </p>
          <div className="flex flex-wrap gap-3">
            {TIERS.map((t) => (
              <form key={t} method="post" action={`/api/tenants/${tenant.slug}/tier`}>
                <input type="hidden" name="tier" value={t} />
                <button
                  type="submit"
                  disabled={t === tenant.tier}
                  className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
                    t === tenant.tier
                      ? 'bg-brand text-white border-brand rounded-md cursor-default'
                      : 'border-line text-mute-1 hover:border-brand hover:text-brand'
                  }`}
                >
                  {t}
                </button>
              </form>
            ))}
          </div>
          <p className="font-body text-xs text-mute-3 mt-3">
            Upgrade enables already-present modules instantly; downgrade retains-but-locks
            higher-tier data (never deletes).
          </p>
        </section>

        {/* branding: logo + brand color, updatable at any time, applies live */}
        <section className="rounded-lg border border-line bg-surface p-5 mb-10">
          <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
            Branding — applies to the live instance immediately
          </p>
          <form
            method="post"
            action={`/api/tenants/${tenant.slug}/branding`}
            encType="multipart/form-data"
            className="flex flex-wrap items-end gap-3"
          >
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Brand color
              <input
                name="brand"
                placeholder="#4F46E5"
                pattern="#[0-9a-fA-F]{6}"
                defaultValue={brand ?? ''}
                className="rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk focus:outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Logo URL
              <input
                name="logoUrl"
                placeholder="https://…/logo.png"
                className="rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk focus:outline-none focus:border-brand"
              />
            </label>
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              or upload (≤300KB)
              <input
                type="file"
                name="logoFile"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="font-body text-sm text-mute-1"
              />
            </label>
            <label className="flex items-center gap-2 font-body text-xs font-medium text-mute-1 pb-3">
              <input type="checkbox" name="clearLogo" /> clear logo
            </label>
            <button
              type="submit"
              className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-600 transition-colors"
            >
              Update branding
            </button>
          </form>
        </section>

        {/* resolved entitlements */}
        <section className="mb-10">
          <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
            Resolved module entitlements
          </p>
          <div className="flex flex-wrap gap-2">
            {MODULES.map((m) => {
              const e = entitlements[m.key];
              const on = e?.enabled && !e.locked;
              const locked = e?.enabled && e.locked;
              return (
                <span
                  key={m.key}
                  className={`px-4 py-2 border font-body text-xs tracking-widest uppercase ${
                    on
                      ? 'border-brand text-brand'
                      : locked
                        ? 'border-line text-mute-2 line-through'
                        : 'border-line text-mute-3 opacity-50'
                  }`}
                  title={locked ? 'retained-but-locked (downgrade)' : undefined}
                >
                  {m.label}
                </span>
              );
            })}
          </div>
        </section>

        {/* domains */}
        <section className="mb-10">
          <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">Domains</p>
          {domains.length === 0 ? (
            <p className="font-heading italic text-mute-3">None yet.</p>
          ) : (
            <ul className="font-body text-sm text-mute-1 space-y-1">
              {domains.map((d) => (
                <li key={d.hostname}>
                  {d.hostname} · {d.type} · {d.status}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* provisioning runs with step ledger */}
        <section>
          <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
            Provisioning runs
          </p>
          <div className="space-y-4">
            {runs.map((r) => (
              <div key={r.id} className="rounded-lg border border-line p-4">
                <div className="font-body text-sm text-chalk mb-3">
                  <span className="font-semibold">{r.kind}</span> · {r.status} · attempt{' '}
                  {r.attempt} · {new Date(r.created_at).toLocaleString()}
                  {r.error && <span className="text-red-600 ml-2">{r.error}</span>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(r.steps ?? {}).map(([key, s]) => (
                    <span
                      key={key}
                      title={s.error}
                      className={`px-3 py-1 font-body text-[11px] tracking-wider uppercase border ${
                        s.status === 'done'
                          ? 'border-line text-mute-2'
                          : s.status === 'failed'
                            ? 'border-red-400 text-red-600'
                            : 'border-line text-mute-3'
                      }`}
                    >
                      {key}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
