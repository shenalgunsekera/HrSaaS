import { NextResponse, type NextRequest } from 'next/server';
import { canUseModule } from '@hr/entitlements';
import { DEFAULT_ROLE_DEFINITIONS, isAllowed, type Role } from '@hr/rbac';
import { withTenantDb } from '../../../../lib/objects';

/**
 * Upsert a review for (employee, period) and — on finalize — compute the
 * weighted final rating: 60% manager rating + 40% weighted goal achievement
 * (weight-averaged progress scaled to the 1–5 scale). Feature sheet D:
 * Rating & Calibration → Weighted Score.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const employeeNumber = String(form.get('employeeNumber') ?? '').trim();
  const period = String(form.get('period') ?? '').trim();
  const selfRating = form.get('selfRating') ? Number(form.get('selfRating')) : null;
  const managerRating = form.get('managerRating') ? Number(form.get('managerRating')) : null;
  const comments = String(form.get('comments') ?? '').trim() || null;
  const finalize = form.get('finalize') === 'on' || form.get('finalize') === 'true';
  const role = (String(form.get('_role') ?? 'manager') || 'manager') as Role;

  if (!employeeNumber || !/^\d{4}(-H[12])?$/.test(period)) {
    return NextResponse.json({ error: 'employeeNumber and period (YYYY or YYYY-H1/H2) required' }, { status: 400 });
  }
  for (const r of [selfRating, managerRating]) {
    if (r !== null && (!Number.isInteger(r) || r < 1 || r > 5)) {
      return NextResponse.json({ error: 'ratings are integers 1–5' }, { status: 400 });
    }
  }
  if (!isAllowed(DEFAULT_ROLE_DEFINITIONS, { role, moduleKey: 'performance', action: 'update', targetScope: 'team' })) {
    return NextResponse.json({ error: `role '${role}' may not record reviews` }, { status: 403 });
  }

  const result = await withTenantDb(async (db, ctx) => {
    if (!canUseModule(ctx.entitlements, 'performance')) {
      return { status: 403 as const, body: { error: 'performance module not entitled for this company' } };
    }
    const [emp] = await db<{ id: string }[]>`
      select id from employees where employee_number = ${employeeNumber}`;
    if (!emp) return { status: 404 as const, body: { error: 'employee not found' } };

    const [existing] = await db<{ id: string; status: string }[]>`
      select id, status from performance_reviews where employee_id = ${emp.id} and period = ${period}`;
    if (existing?.status === 'finalized') {
      return { status: 409 as const, body: { error: 'review already finalized' } };
    }

    let finalRating: number | null = null;
    let status = 'draft';
    if (finalize) {
      if (managerRating === null) {
        return { status: 400 as const, body: { error: 'manager rating required to finalize' } };
      }
      const goals = await db<{ weight: string; progress: number }[]>`
        select weight, progress from goals where employee_id = ${emp.id} and status <> 'dropped'`;
      const totalWeight = goals.reduce((a, g) => a + Number(g.weight), 0);
      const goalScore = totalWeight > 0
        ? (goals.reduce((a, g) => a + Number(g.weight) * g.progress, 0) / totalWeight / 100) * 5
        : managerRating; // no goals → manager rating carries full weight
      finalRating = Math.round((0.6 * managerRating + 0.4 * goalScore) * 100) / 100;
      status = 'finalized';
    }

    await db`insert into performance_reviews
        (employee_id, period, self_rating, manager_rating, final_rating, status, comments)
      values (${emp.id}, ${period}, ${selfRating}, ${managerRating}, ${finalRating}, ${status}, ${comments})
      on conflict (employee_id, period) do update set
        self_rating = coalesce(excluded.self_rating, performance_reviews.self_rating),
        manager_rating = coalesce(excluded.manager_rating, performance_reviews.manager_rating),
        final_rating = excluded.final_rating,
        status = excluded.status,
        comments = coalesce(excluded.comments, performance_reviews.comments)`;
    await db`insert into audit_log (action, object_key, detail)
      values ('review.recorded', 'performance-review', ${db.json({ employeeNumber, period, status, finalRating })})`;
    return { status: 200 as const, body: { period, status, finalRating } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if (result.status === 200 && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/performance', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
