import { NextResponse, type NextRequest } from 'next/server';
import { canUseModule } from '@hr/entitlements';
import { withTenantDb } from '../../../../lib/objects';

/** Add a candidate to a vacancy's pipeline. */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const vacancyId = String(form.get('vacancyId') ?? '');
  const fullName = String(form.get('fullName') ?? '').trim();
  const email = String(form.get('email') ?? '').trim();
  const source = String(form.get('source') ?? 'career-portal');
  if (!vacancyId || !fullName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'vacancyId, fullName and valid email required' }, { status: 400 });
  }

  const result = await withTenantDb(async (db, ctx) => {
    if (!canUseModule(ctx.entitlements, 'recruitment')) {
      return { status: 403 as const, body: { error: 'recruitment module not entitled for this company' } };
    }
    const [v] = await db<{ id: string; status: string }[]>`
      select id, status from vacancies where id = ${vacancyId}`;
    if (!v) return { status: 404 as const, body: { error: 'vacancy not found' } };
    if (v.status !== 'open') return { status: 409 as const, body: { error: `vacancy is ${v.status}` } };
    // duplicate candidate check (feature sheet D)
    const [dupe] = await db<{ id: string }[]>`
      select id from candidates where vacancy_id = ${vacancyId} and lower(email) = ${email.toLowerCase()}`;
    if (dupe) return { status: 409 as const, body: { error: 'candidate already in this pipeline' } };
    const [row] = await db<{ id: string }[]>`
      insert into candidates (vacancy_id, full_name, email, source)
      values (${vacancyId}, ${fullName}, ${email}, ${source}) returning id`;
    return { status: 201 as const, body: { id: row!.id } };
  });
  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if (result.status === 201 && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/recruitment', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
