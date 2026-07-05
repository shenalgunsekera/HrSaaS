import postgres from 'postgres';
import { MODULES } from '@hr/entitlements';
import { getTenantContext } from '../../lib/tenant';

/**
 * Instance status — proves the config-driven runtime end to end.
 * The tenant is resolved per request (control plane), never hardcoded:
 * dedicated-container mode pins the slug via env; host mode resolves the
 * Host header. Everything below — identity, tier, theme, dedicated DB —
 * is configuration.
 */
export const dynamic = 'force-dynamic';

export default async function StatusPage() {
  const ctx = await getTenantContext();

  if (!ctx) {
    return (
      <main className="min-h-svh flex items-center justify-center">
        <p className="font-heading italic text-xl text-mute-1">
          No tenant resolved for this host — unknown, inactive, or unprovisioned.
        </p>
      </main>
    );
  }

  const tdb = postgres(ctx.dbUrl, { max: 1, onnotice: () => {} });
  let members = '0';
  let rates = '0';
  let metaCount = 0;
  try {
    const [m] = await tdb<{ count: string }[]>`select count(*)::text as count from tenant_members`;
    const [r] = await tdb<{ count: string }[]>`select count(*)::text as count from statutory_rates`;
    const [k] = await tdb<{ count: string }[]>`select count(*)::text as count from tenant_meta`;
    members = m?.count ?? '0';
    rates = r?.count ?? '0';
    metaCount = Number(k?.count ?? 0);
  } finally {
    await tdb.end({ timeout: 2 });
  }

  const themeVars = (ctx.theme?.colors ?? {}) as React.CSSProperties;
  const displayName = (ctx as { displayName?: string }).displayName ?? ctx.slug;

  return (
    <main style={themeVars} className="relative min-h-svh border-b border-line overflow-hidden">
      <div className="absolute inset-0 bg-brand-radial pointer-events-none" aria-hidden="true" />
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-12 py-24">
        <div className="flex items-center gap-4 mb-6">
          {ctx.theme?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={ctx.theme.logoUrl}
              alt={`${displayName} logo`}
              className="h-14 w-14 object-contain border border-line bg-ink p-1"
            />
          )}
          <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase">
            Tenant instance · {ctx.slug}
          </p>
        </div>
        <h1 className="font-display text-chalk leading-[0.92]" style={{ fontSize: 'clamp(48px, 7vw, 104px)' }}>
          {displayName.toUpperCase()}
          <br />
          <span className="bg-brand-gradient bg-clip-text text-transparent">
            RUNS ON TIER {ctx.tier}
          </span>
        </h1>
        <p className="font-heading italic text-lg md:text-2xl text-mute-1 mt-7 max-w-2xl leading-relaxed">
          Same image as every other tenant — this identity, theme, tier and the
          dedicated database <span className="text-brand">{ctx.dbRef}</span> all
          arrived as configuration.
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line mt-12">
          {[
            { k: members, v: 'Members in this tenant DB' },
            { k: rates, v: 'Statutory rates seeded' },
            { k: String(metaCount), v: 'Meta keys written by factory' },
            { k: ctx.tier, v: 'Entitlement tier' },
          ].map((s) => (
            <div key={s.v} className="bg-ink px-8 py-6 hover:bg-brand-50 transition-colors duration-300">
              <div className="text-3xl font-bold text-brand">{s.k}</div>
              <div className="font-body text-sm text-mute-2 mt-1.5">{s.v}</div>
            </div>
          ))}
        </div>

        <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mt-14 mb-6">
          Modules resolved from the feature-sheet matrix
        </p>
        <div className="flex flex-wrap gap-2">
          {MODULES.map((m) => {
            const e = ctx.entitlements[m.key];
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
