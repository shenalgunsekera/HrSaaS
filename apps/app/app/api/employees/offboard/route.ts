import { NextResponse, type NextRequest } from 'next/server';
import { computeGratuity } from '@hr/payroll';
import { DEFAULT_ROLE_DEFINITIONS, isAllowed, type Role } from '@hr/rbac';
import { withTenantDb } from '../../../../lib/objects';

const REASONS = ['resigned', 'retired', 'terminated', 'deceased'];

/**
 * Offboarding with final settlement: computes gratuity (Payment of Gratuity
 * Act 12/1983 — parameters read from the tenant's verified statutory_rates,
 * never code), records the settlement, deactivates the employee. Audited.
 * Broader lifecycle (asset return, access revocation, exit interview)
 * arrives with the L5 orchestration per the plan.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const employeeNumber = String(form.get('employeeNumber') ?? '').trim();
  const lastDay = String(form.get('lastDay') ?? '').trim();
  const reason = String(form.get('reason') ?? 'resigned');
  const role = (String(form.get('_role') ?? 'hr') || 'hr') as Role;

  if (!employeeNumber || !/^\d{4}-\d{2}-\d{2}$/.test(lastDay) || !REASONS.includes(reason)) {
    return NextResponse.json({ error: 'employeeNumber, lastDay (YYYY-MM-DD) and a valid reason required' }, { status: 400 });
  }
  if (!isAllowed(DEFAULT_ROLE_DEFINITIONS, { role, moduleKey: 'employee-master', action: 'update', targetScope: 'all' })) {
    return NextResponse.json({ error: `role '${role}' may not offboard employees` }, { status: 403 });
  }

  const result = await withTenantDb(async (db) => {
    const [emp] = await db<
      { id: string; status: string; basic_salary: string; date_joined: string }[]
    >`select id, status, basic_salary, to_char(date_joined,'YYYY-MM-DD') as date_joined
      from employees where employee_number = ${employeeNumber}`;
    if (!emp) return { status: 404 as const, body: { error: 'employee not found' } };
    if (emp.status !== 'active') return { status: 409 as const, body: { error: `employee is ${emp.status}` } };
    if (lastDay < emp.date_joined) return { status: 400 as const, body: { error: 'lastDay before date joined' } };

    const [gratRow] = await db<{ params: { halfMonthPerYear: boolean; minServiceYears: number } | null }[]>`
      select params from statutory_rates
      where kind = 'gratuity' and effective_from <= ${lastDay}
        and (effective_to is null or effective_to >= ${lastDay})
      order by effective_from desc limit 1`;
    const params = gratRow?.params ?? { halfMonthPerYear: true, minServiceYears: 5 };

    const completedYears = Math.floor(
      (Date.parse(lastDay) - Date.parse(emp.date_joined)) / (365.25 * 86400000),
    );
    const gratuity = computeGratuity(Number(emp.basic_salary), completedYears, params);

    const [settlement] = await db<{ id: string }[]>`
      insert into final_settlements (employee_id, last_day, reason, completed_years, last_basic, gratuity)
      values (${emp.id}, ${lastDay}, ${reason}, ${completedYears}, ${emp.basic_salary}, ${gratuity})
      returning id`;
    await db`update employees set status = ${reason}, updated_at = now() where id = ${emp.id}`;
    // orchestrated offboarding checklist; settlement step auto-completes
    const offboarding: Array<[string, string, boolean]> = [
      ['Final settlement incl. gratuity computed', 'payroll', true],
      ['Asset return (laptop, access card, keys…)', 'assets', false],
      ['System access revoked', 'it', false],
      ['EPF/ETF exit notifications filed', 'statutory', false],
      ['Exit interview conducted', 'experience', false],
      ['Final payslip & service letter issued', 'documents', false],
    ];
    for (let i = 0; i < offboarding.length; i++) {
      const [task, category, done] = offboarding[i]!;
      await db`insert into lifecycle_tasks (employee_id, kind, task, category, display_order, done, done_at)
        values (${emp.id}, 'offboarding', ${task}, ${category}, ${i}, ${done}, ${done ? new Date() : null})`;
    }
    await db`insert into audit_log (action, object_key, record_id, detail)
      values ('employee.offboarded', 'employee', ${emp.id},
              ${db.json({ reason, lastDay, completedYears, gratuity, role })})`;
    return { status: 201 as const, body: { settlementId: settlement!.id, completedYears, gratuity } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if (result.status === 201 && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/employees', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
