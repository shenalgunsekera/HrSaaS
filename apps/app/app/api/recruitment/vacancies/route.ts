import { NextResponse, type NextRequest } from 'next/server';
import { canUseModule } from '@hr/entitlements';
import { withTenantDb } from '../../../../lib/objects';

/** Create a vacancy. Recruitment is L2+ — the company gate runs first. */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const title = String(form.get('title') ?? '').trim();
  const department = String(form.get('department') ?? '').trim() || null;
  const headcount = Math.max(1, Number(form.get('headcount')) || 1);
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

  const result = await withTenantDb(async (db, ctx) => {
    if (!canUseModule(ctx.entitlements, 'recruitment')) {
      return { status: 403 as const, body: { error: 'recruitment module not entitled for this company' } };
    }
    const [row] = await db<{ id: string }[]>`
      insert into vacancies (title, department, headcount)
      values (${title}, ${department}, ${headcount}) returning id`;
    await db`insert into audit_log (action, object_key, record_id)
      values ('vacancy.created', 'vacancy', ${row!.id})`;
    return { status: 201 as const, body: { id: row!.id } };
  });
  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if (result.status === 201 && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/recruitment', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
