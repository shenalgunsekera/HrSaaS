import { NextResponse, type NextRequest } from 'next/server';
import { canUseModule } from '@hr/entitlements';
import { withTenantDb } from '../../../lib/objects';

/**
 * Training operations (L2-gated), one endpoint, op-dispatched:
 *  op=course   title, category?, mandatory?, durationHours?, validityMonths?
 *  op=enroll   courseId, employeeNumber
 *  op=complete enrollmentId, score  (≥50 passes; cert expiry from validity)
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const op = String(form.get('op') ?? '');

  const result = await withTenantDb(async (db, ctx) => {
    if (!canUseModule(ctx.entitlements, 'training')) {
      return { status: 403 as const, body: { error: 'training module not entitled for this company' } };
    }

    if (op === 'course') {
      const title = String(form.get('title') ?? '').trim();
      if (!title) return { status: 400 as const, body: { error: 'title required' } };
      const validity = Number(form.get('validityMonths'));
      const [row] = await db<{ id: string }[]>`
        insert into courses (title, category, mandatory, duration_hours, validity_months)
        values (${title}, ${String(form.get('category') ?? 'general') || 'general'},
                ${form.get('mandatory') === 'on' || form.get('mandatory') === 'true'},
                ${Number(form.get('durationHours')) || null},
                ${Number.isInteger(validity) && validity > 0 ? validity : null})
        returning id`;
      return { status: 201 as const, body: { id: row!.id } };
    }

    if (op === 'enroll') {
      const courseId = String(form.get('courseId') ?? '');
      const employeeNumber = String(form.get('employeeNumber') ?? '').trim();
      const [emp] = await db<{ id: string }[]>`
        select id from employees where employee_number = ${employeeNumber} and status = 'active'`;
      if (!emp) return { status: 404 as const, body: { error: 'active employee not found' } };
      const [row] = await db<{ id: string }[]>`
        insert into enrollments (course_id, employee_id) values (${courseId}, ${emp.id})
        on conflict (course_id, employee_id) do nothing returning id`;
      if (!row) return { status: 409 as const, body: { error: 'already enrolled' } };
      return { status: 201 as const, body: { id: row.id } };
    }

    if (op === 'complete') {
      const enrollmentId = String(form.get('enrollmentId') ?? '');
      const score = Number(form.get('score'));
      if (!Number.isInteger(score) || score < 0 || score > 100) {
        return { status: 400 as const, body: { error: 'score 0–100 required' } };
      }
      const [row] = await db<{ id: string; validity_months: number | null; passed: boolean }[]>`
        update enrollments e set
          status = case when ${score} >= 50 then 'completed' else 'failed' end,
          score = ${score},
          completed_at = now(),
          expires_at = case when ${score} >= 50 and c.validity_months is not null
            then (current_date + (c.validity_months || ' months')::interval)::date end
        from courses c
        where e.id = ${enrollmentId} and c.id = e.course_id and e.status = 'enrolled'
        returning e.id, c.validity_months, (${score} >= 50) as passed`;
      if (!row) return { status: 409 as const, body: { error: 'not found or already assessed' } };
      await db`insert into audit_log (action, object_key, record_id, detail)
        values ('training.assessed', 'enrollment', ${enrollmentId}, ${db.json({ score })})`;
      return { status: 200 as const, body: { id: row.id, passed: row.passed } };
    }

    return { status: 400 as const, body: { error: 'unknown op' } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if ((result.status === 200 || result.status === 201) && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/training', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
