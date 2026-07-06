import { NextResponse, type NextRequest } from 'next/server';
import { canUseModule } from '@hr/entitlements';
import { withTenantDb } from '../../../lib/objects';

/**
 * Workforce Planning (L3-gated):
 *  op=plan      department, period YYYY-MM, approvedHeadcount, budgetCost?
 *  op=position  title, department
 *  op=fill      positionId, employeeNumber
 *  op=freeze    positionId
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const op = String(form.get('op') ?? '');

  const result = await withTenantDb(async (db, ctx) => {
    if (!canUseModule(ctx.entitlements, 'workforce-planning')) {
      return { status: 403 as const, body: { error: 'workforce planning module not entitled for this company' } };
    }

    if (op === 'plan') {
      const department = String(form.get('department') ?? '').trim();
      const period = String(form.get('period') ?? '').trim();
      const approved = Number(form.get('approvedHeadcount'));
      const budget = form.get('budgetCost') ? Number(form.get('budgetCost')) : null;
      if (!department || !/^\d{4}-\d{2}$/.test(period) || !Number.isInteger(approved) || approved < 0) {
        return { status: 400 as const, body: { error: 'department, period YYYY-MM, non-negative approvedHeadcount required' } };
      }
      await db`insert into headcount_plans (department, period, approved_headcount, budget_cost)
        values (${department}, ${period}, ${approved}, ${budget})
        on conflict (department, period) do update set
          approved_headcount = ${approved}, budget_cost = ${budget}`;
      return { status: 201 as const, body: { ok: true } };
    }

    if (op === 'position') {
      const title = String(form.get('title') ?? '').trim();
      const department = String(form.get('department') ?? '').trim();
      if (!title || !department) return { status: 400 as const, body: { error: 'title and department required' } };
      const [row] = await db<{ id: string }[]>`
        insert into positions (title, department) values (${title}, ${department}) returning id`;
      return { status: 201 as const, body: { id: row!.id } };
    }

    if (op === 'fill' || op === 'freeze') {
      const positionId = String(form.get('positionId') ?? '');
      if (op === 'freeze') {
        const [row] = await db<{ id: string }[]>`
          update positions set status = 'frozen', holder_id = null where id = ${positionId} returning id`;
        if (!row) return { status: 404 as const, body: { error: 'position not found' } };
        return { status: 200 as const, body: { id: positionId, frozen: true } };
      }
      const employeeNumber = String(form.get('employeeNumber') ?? '').trim();
      const [emp] = await db<{ id: string }[]>`
        select id from employees where employee_number = ${employeeNumber} and status = 'active'`;
      if (!emp) return { status: 404 as const, body: { error: 'active employee not found' } };
      const [row] = await db<{ id: string }[]>`
        update positions set status = 'filled', holder_id = ${emp.id}
        where id = ${positionId} and status <> 'frozen' returning id`;
      if (!row) return { status: 409 as const, body: { error: 'position frozen or not found' } };
      return { status: 200 as const, body: { id: positionId, filled: true } };
    }

    return { status: 400 as const, body: { error: 'unknown op' } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if ((result.status === 200 || result.status === 201) && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/workforce', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
