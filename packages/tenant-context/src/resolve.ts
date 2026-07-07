/**
 * Hostname → TenantContext resolution against the control plane (Phase 3).
 *
 * Injected `secretResolver` turns a control-plane dbRef into a connection
 * string (local driver: _secrets files / container env; production: vault).
 * Results are cached briefly so the control plane is not hit per request.
 * A hostname that matches no ACTIVE tenant domain resolves to null — the
 * routing layer can never "fall through" to another tenant's datastore.
 */
import postgres from 'postgres';
import { resolveEntitlements, type Tier } from '@hr/entitlements';
import type { TenantContext } from './index';

export interface ResolverOptions {
  controlPlaneUrl: string;
  secretResolver: (dbRef: string, slug: string) => Promise<string | null>;
  cacheTtlMs?: number;
}

interface CacheEntry {
  at: number;
  ctx: (TenantContext & { dbUrl: string }) | null;
}

export function createTenantResolver(opts: ResolverOptions) {
  const ttl = opts.cacheTtlMs ?? 30_000;
  // Enable SSL for remote hosts (Supabase); off for local dev containers.
  const remote = !/localhost|127\.0\.0\.1/.test(opts.controlPlaneUrl);
  const sql = postgres(opts.controlPlaneUrl, {
    max: 2,
    onnotice: () => {},
    ...(remote ? { ssl: 'require' as const } : {}),
  });
  const cache = new Map<string, CacheEntry>();

  async function load(where: 'hostname' | 'slug', value: string) {
    const rows =
      where === 'hostname'
        ? await sql`
            select t.id, t.slug, t.tier, t.max_tier_held, t.status, t.theme, t.db_ref,
                   t.data_residency, t.display_name
            from tenant_domains d
            join tenants t on t.id = d.tenant_id
            where d.hostname = ${value} and d.status = 'active'
            limit 1`
        : await sql`
            select t.id, t.slug, t.tier, t.max_tier_held, t.status, t.theme, t.db_ref,
                   t.data_residency, t.display_name
            from tenants t where t.slug = ${value} limit 1`;
    const t = rows[0];
    if (!t || t.status !== 'active' || !t.db_ref) return null;

    const overrides = await sql`
      select module_key, enabled, locked, expires_at
      from tenant_entitlement_overrides where tenant_id = ${t.id}`;

    const dbUrl = await opts.secretResolver(t.db_ref as string, t.slug as string);
    if (!dbUrl) return null;

    const ctx: TenantContext & { dbUrl: string; displayName: string } = {
      tenantId: t.id as string,
      slug: t.slug as string,
      tier: t.tier as Tier,
      entitlements: resolveEntitlements({
        tier: t.tier as Tier,
        maxTierHeld: t.max_tier_held as Tier,
        overrides: overrides.map((o) => ({
          moduleKey: o.module_key as never,
          enabled: o.enabled as boolean,
          locked: o.locked as boolean,
          expiresAt: o.expires_at as Date | null,
        })),
      }),
      theme: (t.theme as TenantContext['theme']) ?? null,
      dbRef: t.db_ref as string,
      dataResidency: t.data_residency as string,
      dbUrl,
      displayName: t.display_name as string,
    };
    return ctx;
  }

  async function cached(key: string, where: 'hostname' | 'slug', value: string) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < ttl) return hit.ctx;
    const ctx = await load(where, value);
    cache.set(key, { at: Date.now(), ctx });
    return ctx;
  }

  return {
    /** Resolve by request hostname (strips port). */
    byHostname: (hostname: string) => {
      const clean = hostname.replace(/:\d+$/, '').toLowerCase();
      return cached(`h:${clean}`, 'hostname', clean);
    },
    /** Resolve by slug (dedicated-container mode where the slug is pinned). */
    bySlug: (slug: string) => cached(`s:${slug}`, 'slug', slug),
    end: () => sql.end({ timeout: 2 }),
  };
}
