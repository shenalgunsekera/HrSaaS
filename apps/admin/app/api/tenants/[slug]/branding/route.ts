import { NextResponse, type NextRequest } from 'next/server';
import { cp } from '../../../../../lib/cp';
import { themeFromBrand } from '../../../../../../../scripts/factory.mjs';

const MAX_LOGO_BYTES = 300 * 1024;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

/**
 * Update a tenant's branding (logo + brand color) at any time. Applies live:
 * tenant instances read theme from the control plane per request, so no
 * redeploy. Logo can be a URL or an uploaded file (stored as a data URI in
 * the local driver; production driver uploads to tenant storage instead).
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const form = await request.formData();
  const brand = String(form.get('brand') ?? '').trim();
  const logoUrlInput = String(form.get('logoUrl') ?? '').trim();
  const logoFile = form.get('logoFile');

  if (brand && !/^#[0-9a-fA-F]{6}$/.test(brand)) {
    return NextResponse.json({ error: 'invalid brand color' }, { status: 400 });
  }

  let logoUrl: string | null = null;
  if (logoFile instanceof File && logoFile.size > 0) {
    if (!LOGO_TYPES.includes(logoFile.type)) {
      return NextResponse.json({ error: 'unsupported logo type' }, { status: 400 });
    }
    if (logoFile.size > MAX_LOGO_BYTES) {
      return NextResponse.json({ error: 'logo too large (max 300KB)' }, { status: 400 });
    }
    const buf = Buffer.from(await logoFile.arrayBuffer());
    logoUrl = `data:${logoFile.type};base64,${buf.toString('base64')}`;
  } else if (logoUrlInput) {
    if (!/^https?:\/\//.test(logoUrlInput) && !logoUrlInput.startsWith('data:image/')) {
      return NextResponse.json({ error: 'logo must be an http(s) URL' }, { status: 400 });
    }
    logoUrl = logoUrlInput;
  }

  const sql = cp();
  const [tenant] = await sql<{ id: string; theme: Record<string, unknown> | null }[]>`
    select id, theme from tenants where slug = ${slug}`;
  if (!tenant) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const next: Record<string, unknown> = { ...(tenant.theme ?? {}) };
  if (brand) Object.assign(next, themeFromBrand(brand) ?? {});
  if (logoUrl) next.logoUrl = logoUrl;
  if (form.get('clearLogo') === 'on') delete next.logoUrl;

  await sql`update tenants set theme = ${sql.json(next as never)}, updated_at = now()
    where id = ${tenant.id}`;
  await sql`insert into control_plane_audit_log (actor, action, tenant_id, detail)
    values ('system-admin', 'tenant.branding_updated', ${tenant.id},
            ${sql.json({ brand: brand || undefined, logo: logoUrl ? 'set' : form.get('clearLogo') === 'on' ? 'cleared' : 'unchanged' })})`;

  if (request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL(`/tenants/${slug}`, request.url), 303);
  }
  return NextResponse.json({ slug, updated: true });
}
