import { NextResponse, type NextRequest } from 'next/server';
import { cp } from '../../../../../lib/cp';
import { enqueueProvision } from '../../../../../../../scripts/factory.mjs';

const SLUG_RE = /^[a-z][a-z0-9-]{1,30}$/;
const TIERS = ['L1', 'L2', 'L3', 'L4', 'L5'];

/**
 * Prospect → tenant conversion: the consultation record (company name,
 * contact email, tier interest, branding intake) carries straight into the
 * provisioning queue — no re-keying (§7 handoff).
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const form = await request.formData();
  const slug = String(form.get('slug') ?? '').trim().toLowerCase();
  const tier = String(form.get('tier') ?? 'L1');
  const brand = String(form.get('brand') ?? '').trim() || null;

  if (!SLUG_RE.test(slug)) return NextResponse.json({ error: 'invalid slug' }, { status: 400 });
  if (!TIERS.includes(tier)) return NextResponse.json({ error: 'invalid tier' }, { status: 400 });

  const sql = cp();
  const [prospect] = await sql<
    { id: string; company_name: string; email: string; converted_tenant_id: string | null;
      branding_intake: { logoUrl?: string; colors?: Record<string, string> } | null }[]
  >`select id, company_name, email, converted_tenant_id, branding_intake
    from prospects where id = ${id}`;
  if (!prospect) return NextResponse.json({ error: 'prospect not found' }, { status: 404 });
  if (prospect.converted_tenant_id) {
    return NextResponse.json({ error: 'already converted' }, { status: 409 });
  }

  const { tenantId, runId } = await enqueueProvision(sql, {
    slug,
    name: prospect.company_name,
    tier,
    brand,
    logoUrl: prospect.branding_intake?.logoUrl ?? null,
    adminEmail: prospect.email,
  });

  await sql`update prospects set converted_tenant_id = ${tenantId} where id = ${id}`;
  await sql`insert into control_plane_audit_log (actor, action, tenant_id, detail)
    values ('system-admin', 'prospect.converted', ${tenantId},
            ${sql.json({ prospectId: id, tier, runId })})`;

  if (request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL(`/tenants/${slug}`, request.url), 303);
  }
  return NextResponse.json({ tenantId, runId, slug }, { status: 202 });
}
