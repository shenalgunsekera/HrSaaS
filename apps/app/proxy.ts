/**
 * Edge proxy (Next 16 rename of middleware.ts).
 *
 * Tenant resolution happens HERE, once per request: hostname → control-plane
 * record → { tenantId, tier, entitlements, theme, dbRef } forwarded via
 * request headers to server components. Never re-derived downstream, never
 * accepted from a client body.
 *
 * Phase 0: pass-through stub tagging the resolved hostname. The control-plane
 * lookup + cache lands in Phase 3.
 */
import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const hostname = request.headers.get('host') ?? '';
  const headers = new Headers(request.headers);
  headers.set('x-tenant-hostname', hostname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets).*)'],
};
