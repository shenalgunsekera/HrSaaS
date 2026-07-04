import postgres from 'postgres';
import {
  MODULES,
  resolveEntitlements,
  type Tier,
} from '@hr/entitlements';

/**
 * Instance status — Phase 1 proof of the config-driven runtime.
 * This page is identical in every tenant container; everything tenant-specific
 * below arrives via environment/config (control-plane record + dedicated DB).
 * Phase 3 replaces the env-based wiring with per-request host resolution.
 */
export const dynamic = 'force-dynamic';

interface TenantRow {
  slug: string;
  display_name: string;
  tier: Tier;
  status: string;
  max_tier_held: Tier;
  theme: { logoUrl?: string; colors?: Record<string, string> } | null;
  db_ref: string | null;
}

async function loadStatus() {
  const slug = process.env.TENANT_SLUG;
  const cpUrl = process.env.CONTROL_PLANE_DATABASE_URL;
  const tdbUrl = process.env.TENANT_DATABASE_URL;
  if (!slug || !cpUrl || !tdbUrl) return null;

  const cp = postgres(cpUrl, { max: 1 });
  const tdb = postgres(tdbUrl, { max: 1 });
  try {
    const [tenant] = await cp<TenantRow[]>`
      select slug, display_name, tier, status, max_tier_held, theme, db_ref
      from tenants where slug = ${slug} limit 1`;
    if (!tenant) return null;

    const [memberRow] = await tdb<{ count: string }[]>`
      select count(*)::text as count from tenant_members`;
    const [rateRow] = await tdb<{ count: string }[]>`
      select count(*)::text as count from statutory_rates`;
    const members = memberRow?.count ?? '0';
    const rates = rateRow?.count ?? '0';
    const meta = await tdb<{ key: string; value: unknown }[]>`
      select key, value from tenant_meta order by key`;

    return { tenant, members, rates, meta };
  } finally {
    await cp.end({ timeout: 2 });
    await tdb.end({ timeout: 2 });
  }
}

export default async function StatusPage() {
  const data = await loadStatus();

  if (!data) {
    return (
      <main className="min-h-svh flex items-center justify-center">
        <p className="font-heading italic text-xl text-mute-1">
          No tenant context — this instance was started without provisioned config.
        </p>
      </main>
    );
  }

  const { tenant, members, rates, meta } = data;
  const entitlements = resolveEntitlements({
    tier: tenant.tier,
    maxTierHeld: tenant.max_tier_held,
  });
  const themeVars = (tenant.theme?.colors ?? {}) as React.CSSProperties;

  return (
    <main style={themeVars} className="relative min-h-svh border-b border-line overflow-hidden">
      <div className="absolute inset-0 bg-grid pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-0 bg-brand-radial pointer-events-none" aria-hidden="true" />
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-12 py-24">
        <p className="font-body text-xs tracking-widest3 text-brand uppercase mb-6">
          Tenant instance · {tenant.slug} · {tenant.status}
        </p>
        <h1 className="font-display text-chalk leading-[0.92]" style={{ fontSize: 'clamp(48px, 7vw, 104px)' }}>
          {tenant.display_name.toUpperCase()}
          <br />
          <span className="bg-brand-gradient bg-clip-text text-transparent">
            RUNS ON TIER {tenant.tier}
          </span>
        </h1>
        <p className="font-heading italic text-lg md:text-2xl text-mute-1 mt-7 max-w-2xl leading-relaxed">
          Same image as every other tenant — this identity, theme, tier and the
          dedicated database <span className="text-brand">{tenant.db_ref}</span> all
          arrived as configuration.
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line mt-12">
          {[
            { k: members, v: 'Members in this tenant DB' },
            { k: rates, v: 'Statutory rates seeded' },
            { k: String(meta.length), v: 'Meta keys written by factory' },
            { k: tenant.tier, v: 'Entitlement tier' },
          ].map((s) => (
            <div key={s.v} className="bg-ink px-8 py-6 hover:bg-brand-50 transition-colors duration-300">
              <div className="font-display text-4xl md:text-5xl text-brand">{s.k}</div>
              <div className="font-body text-sm text-mute-2 mt-1.5">{s.v}</div>
            </div>
          ))}
        </div>

        <p className="font-body text-xs tracking-widest3 text-brand uppercase mt-14 mb-6">
          Modules resolved from the feature-sheet matrix
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
              >
                {m.label}
              </span>
            );
          })}
        </div>
      </div>
    </main>
  );
}
