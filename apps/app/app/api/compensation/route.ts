import { NextResponse, type NextRequest } from 'next/server';
import { canUseModule } from '@hr/entitlements';
import { withTenantDb } from '../../../lib/objects';

/**
 * Compensation operations (L2-gated):
 *  op=band    grade, min, mid, max
 *  op=assign  employeeNumber, grade
 * Compa-ratio (basic / band mid) is computed at read time — never stored.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const op = String(form.get('op') ?? '');

  const result = await withTenantDb(async (db, ctx) => {
    if (!canUseModule(ctx.entitlements, 'compensation')) {
      return { status: 403 as const, body: { error: 'compensation module not entitled for this company' } };
    }

    if (op === 'band') {
      const grade = String(form.get('grade') ?? '').trim().toUpperCase();
      const min = Number(form.get('min'));
      const mid = Number(form.get('mid'));
      const max = Number(form.get('max'));
      if (!grade || ![min, mid, max].every((n) => Number.isFinite(n) && n > 0) || !(min <= mid && mid <= max)) {
        return { status: 400 as const, body: { error: 'grade and min ≤ mid ≤ max required' } };
      }
      await db`insert into salary_bands (grade, band_min, band_mid, band_max)
        values (${grade}, ${min}, ${mid}, ${max})
        on conflict (grade) do update set band_min = ${min}, band_mid = ${mid}, band_max = ${max}`;
      return { status: 201 as const, body: { grade } };
    }

    if (op === 'assign') {
      const employeeNumber = String(form.get('employeeNumber') ?? '').trim();
      const grade = String(form.get('grade') ?? '').trim().toUpperCase();
      const [band] = await db<{ grade: string }[]>`select grade from salary_bands where grade = ${grade}`;
      if (!band) return { status: 404 as const, body: { error: 'band not found' } };
      const [emp] = await db<{ id: string }[]>`
        update employees set salary_grade = ${grade}, updated_at = now()
        where employee_number = ${employeeNumber} returning id`;
      if (!emp) return { status: 404 as const, body: { error: 'employee not found' } };
      await db`insert into audit_log (action, object_key, record_id, detail)
        values ('compensation.grade_assigned', 'employee', ${emp.id}, ${db.json({ grade })})`;
      return { status: 200 as const, body: { employeeNumber, grade } };
    }

    return { status: 400 as const, body: { error: 'unknown op' } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if ((result.status === 200 || result.status === 201) && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/compensation', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
