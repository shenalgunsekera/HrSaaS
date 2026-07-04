import { NextResponse, type NextRequest } from 'next/server';
import { cp } from '../../../../../lib/cp';

const TIERS = ['L1', 'L2', 'L3', 'L4', 'L5'];

/**
 * Tier flip — upgrade or downgrade. Pure entitlement change: no migration,
 * no redeploy (non-negotiable #6). Downgrade preserves max_tier_held so the
 * higher-tier modules resolve as retain-but-lock.
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  let tier: string | undefined;
  if (request.headers.get('content-type')?.includes('application/json')) {
    tier = ((await request.json()) as { tier?: string }).tier;
  } else {
    tier = String((await request.formData()).get('tier') ?? '');
  }
  if (!tier || !TIERS.includes(tier)) {
    return NextResponse.json({ error: 'invalid tier' }, { status: 400 });
  }

  const sql = cp();
  const [tenant] = await sql<{ id: string; tier: string }[]>`
    select id, tier from tenants where slug = ${slug}`;
  if (!tenant) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await sql`update tenants set
      tier = ${tier},
      max_tier_held = case when max_tier_held >= ${tier} then max_tier_held else ${tier} end,
      status = case when status = 'downgraded_locked' then 'active' else status end,
      updated_at = now()
    where id = ${tenant.id}`;
  await sql`insert into control_plane_audit_log (actor, action, tenant_id, detail)
    values ('system-admin', 'tenant.tier_changed', ${tenant.id},
            ${sql.json({ from: tenant.tier, to: tier })})`;

  if (request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL(`/tenants/${slug}`, request.url), 303);
  }
  return NextResponse.json({ slug, tier });
}
