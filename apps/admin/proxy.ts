/**
 * Admin console gate — HTTP Basic Auth (interim until the central IdP,
 * ADR-0007 §6). Credentials come from the environment; if none are set the
 * console only answers on localhost. Vendor-side app: never tenant-facing.
 */
import { NextResponse, type NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;

  if (!user || !pass) {
    // No credentials configured: refuse anything that isn't local loopback.
    const host = request.headers.get('host') ?? '';
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) {
      return new NextResponse('admin console locked: configure ADMIN_USER/ADMIN_PASSWORD', {
        status: 403,
      });
    }
    return NextResponse.next();
  }

  const header = request.headers.get('authorization') ?? '';
  const expected = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
  if (header !== expected) {
    return new NextResponse('authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="HR Control Plane"' },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets).*)'],
};
