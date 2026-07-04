import { NextResponse, type NextRequest } from 'next/server';
import { cp } from '../../../lib/cp';
// Shared factory module (same code path as the CLI and worker).
import { enqueueProvision } from '../../../../../scripts/factory.mjs';

const SLUG_RE = /^[a-z][a-z0-9-]{1,30}$/;
const TIERS = ['L1', 'L2', 'L3', 'L4', 'L5'];

/**
 * Create (or resume) a tenant: upserts the registry row and enqueues a
 * provisioning run for the worker. Accepts form posts (admin UI) and JSON.
 */
export async function POST(request: NextRequest) {
  let body: Record<string, string>;
  if (request.headers.get('content-type')?.includes('application/json')) {
    body = (await request.json()) as Record<string, string>;
  } else {
    body = Object.fromEntries(
      [...(await request.formData()).entries()].map(([k, v]) => [k, String(v)]),
    );
  }

  const slug = body.slug?.trim().toLowerCase() ?? '';
  const tier = body.tier ?? 'L1';
  const name = body.name?.trim() || slug;
  const brand = body.brand?.trim() || null;
  const logoUrl = body.logoUrl?.trim() || null;

  if (!SLUG_RE.test(slug)) {
    return NextResponse.json({ error: 'invalid slug' }, { status: 400 });
  }
  if (!TIERS.includes(tier)) {
    return NextResponse.json({ error: 'invalid tier' }, { status: 400 });
  }
  if (brand && !/^#[0-9a-fA-F]{6}$/.test(brand)) {
    return NextResponse.json({ error: 'invalid brand color' }, { status: 400 });
  }
  if (logoUrl && !/^https?:\/\//.test(logoUrl) && !logoUrl.startsWith('data:image/')) {
    return NextResponse.json({ error: 'logo must be an http(s) URL' }, { status: 400 });
  }

  const sql = cp();
  const { tenantId, runId } = await enqueueProvision(sql, { slug, name, tier, brand, logoUrl });
  await sql`insert into control_plane_audit_log (actor, action, tenant_id, detail)
    values ('system-admin', 'tenant.create_requested', ${tenantId}, ${sql.json({ tier, runId })})`;

  if (request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL(`/tenants/${slug}`, request.url), 303);
  }
  return NextResponse.json({ tenantId, runId, slug }, { status: 202 });
}
