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

  return (
    <main className="relative min-h-svh">
      <div className="absolute inset-0 bg-grid pointer-events-none" aria-hidden="true" />
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-12 py-16">
        <Link href="/" className="font-body text-xs tracking-widest3 text-brand uppercase">
          ← All tenants
        </Link>
        <div className="flex flex-wrap items-baseline gap-5 mt-4 mb-2">
          <h1 className="font-display text-chalk leading-[0.92]" style={{ fontSize: 'clamp(40px, 5vw, 72px)' }}>
            {tenant.display_name.toUpperCase()}
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
        <section className="border border-line bg-surface p-6 mb-10">
          <p className="font-body text-xs tracking-widest3 text-brand uppercase mb-4">
            Tier — currently {tenant.tier} (max held {tenant.max_tier_held})
          </p>
          <div className="flex flex-wrap gap-3">
            {TIERS.map((t) => (
              <form key={t} method="post" action={`/api/tenants/${tenant.slug}/tier`}>
                <input type="hidden" name="tier" value={t} />
                <button
                  type="submit"
                  disabled={t === tenant.tier}
                  className={`px-6 py-2.5 font-display tracking-widest text-sm border transition-colors ${
                    t === tenant.tier
                      ? 'bg-brand text-white border-brand cursor-default'
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

        {/* resolved entitlements */}
        <section className="mb-10">
          <p className="font-body text-xs tracking-widest3 text-brand uppercase mb-4">
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
          <p className="font-body text-xs tracking-widest3 text-brand uppercase mb-4">Domains</p>
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
          <p className="font-body text-xs tracking-widest3 text-brand uppercase mb-4">
            Provisioning runs
          </p>
          <div className="space-y-4">
            {runs.map((r) => (
              <div key={r.id} className="border border-line p-5">
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
