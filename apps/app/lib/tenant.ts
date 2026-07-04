import 'server-only';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { headers } from 'next/headers';
import { createTenantResolver } from '@hr/tenant-context';

/**
 * Per-request tenant context (Phase 3).
 *
 * Two deployment shapes, one resolution path:
 *  - Dedicated container (local driver): TENANT_SLUG env pins the tenant;
 *    resolution still goes through the control plane (tier/theme/status are
 *    always live) but the DB URL comes from the container's env.
 *  - Shared ingress / host mode: the tenant is resolved from the request
 *    Host header; an unknown or inactive hostname resolves to nothing.
 *
 * The tenant is NEVER taken from a client-supplied body or query value.
 */

function localSecretResolver() {
  return async (dbRef: string, slug: string): Promise<string | null> => {
    // Dedicated-container mode: this process serves exactly one tenant.
    if (process.env.TENANT_SLUG === slug && process.env.TENANT_DATABASE_URL) {
      return process.env.TENANT_DATABASE_URL;
    }
    // Host mode (local driver): db_ref = local-docker:<container>; the
    // factory stored the published port + password in _secrets/.
    const m = /^local-docker:(.+)$/.exec(dbRef);
    if (!m) return null;
    try {
      const secret = JSON.parse(
        readFileSync(path.join(process.cwd(), '..', '..', '_secrets', `${m[1]}.json`), 'utf8'),
      ) as { password: string; port: number };
      return `postgres://postgres:${secret.password}@127.0.0.1:${secret.port}/postgres`;
    } catch {
      return null;
    }
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __tenantResolver: ReturnType<typeof createTenantResolver> | undefined;
}

function resolver() {
  const controlPlaneUrl = process.env.CONTROL_PLANE_DATABASE_URL;
  if (!controlPlaneUrl) return null;
  globalThis.__tenantResolver ??= createTenantResolver({
    controlPlaneUrl,
    secretResolver: localSecretResolver(),
  });
  return globalThis.__tenantResolver;
}

export async function getTenantContext() {
  const r = resolver();
  if (!r) return null;
  if (process.env.TENANT_SLUG) return r.bySlug(process.env.TENANT_SLUG);
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  if (!host) return null;
  return r.byHostname(host);
}
