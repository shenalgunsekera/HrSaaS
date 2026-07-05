import { NextResponse, type NextRequest } from 'next/server';
import { canUseModule } from '@hr/entitlements';
import { withTenantDb } from '../../../../lib/objects';

/** Create a goal (op=create) or update progress (op=progress). L2-gated. */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const op = String(form.get('op') ?? 'create');

  const result = await withTenantDb(async (db, ctx) => {
    if (!canUseModule(ctx.entitlements, 'performance')) {
      return { status: 403 as const, body: { error: 'performance module not entitled for this company' } };
    }
    if (op === 'progress') {
      const id = String(form.get('id') ?? '');
      const progress = Math.max(0, Math.min(100, Number(form.get('progress')) || 0));
      const [row] = await db<{ id: string }[]>`
        update goals set progress = ${progress},
          status = case when ${progress} = 100 then 'achieved' else status end
        where id = ${id} returning id`;
      if (!row) return { status: 404 as const, body: { error: 'goal not found' } };
      return { status: 200 as const, body: { id, progress } };
    }
    const employeeNumber = String(form.get('employeeNumber') ?? '').trim();
    const title = String(form.get('title') ?? '').trim();
    const weight = Number(form.get('weight')) || 1;
    const targetDate = String(form.get('targetDate') ?? '').trim() || null;
    if (!employeeNumber || !title) {
      return { status: 400 as const, body: { error: 'employeeNumber and title required' } };
    }
    const [emp] = await db<{ id: string }[]>`
      select id from employees where employee_number = ${employeeNumber} and status = 'active'`;
    if (!emp) return { status: 404 as const, body: { error: 'active employee not found' } };
    const [row] = await db<{ id: string }[]>`
      insert into goals (employee_id, title, weight, target_date)
      values (${emp.id}, ${title}, ${weight}, ${targetDate}) returning id`;
    return { status: 201 as const, body: { id: row!.id } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if ((result.status === 201 || result.status === 200) && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/performance', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
