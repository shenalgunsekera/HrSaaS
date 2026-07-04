/**
 * Tenant context — resolved ONCE per request at the edge (apps' proxy.ts)
 * from the host header (and/or auth token), then read everywhere downstream.
 * A tenant id is NEVER accepted from a client body and never re-derived.
 *
 * Isolation model (fixed): every tenant has a dedicated database. `dbRef`
 * resolves to THAT tenant's own connection; there are no shared business
 * tables. RLS inside the tenant DB is defense in depth for user/role scoping.
 */
import type { EntitlementSet, Tier } from '@hr/entitlements';

export interface TenantTheme {
  logoUrl?: string;
  colors?: Record<string, string>;
}

export interface TenantContext {
  tenantId: string;
  slug: string;
  tier: Tier;
  entitlements: EntitlementSet;
  theme: TenantTheme | null;
  /** Dedicated datastore reference (Supabase project ref / instance id). */
  dbRef: string;
  dataResidency: string;
}

/**
 * Contract for the edge resolver. Implementation (control-plane lookup with
 * caching) lands in Phase 3; the marketing app resolves no tenant.
 */
export type ResolveTenant = (hostname: string) => Promise<TenantContext | null>;

/**
 * Contract for the tenant-aware data access layer: given the request's
 * TenantContext, return a client bound to that tenant's DEDICATED database.
 * Server-only; service_role keys never reach the client bundle.
 */
export type TenantDb<Client> = (ctx: TenantContext) => Promise<Client>;
