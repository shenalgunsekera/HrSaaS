import { NextResponse, type NextRequest } from 'next/server';
import { canUseModule } from '@hr/entitlements';
import { withTenantDb } from '../../../../../../lib/objects';
import { spawnOnboarding } from '../../../../../../lib/hr';
import { dispatchWebhooks } from '../../../../../../lib/webhooks';

const FLOW = ['applied', 'shortlisted', 'interview', 'offered', 'hired', 'rejected'];

/**
 * Move a candidate through the pipeline. `hired` converts the candidate into
 * an Employee Master record (with basic salary + start date) and spawns the
 * onboarding journey — recruitment closes the loop into the core.
 */
export async function POST(
  request: NextRequest,
  routeCtx: { params: Promise<{ id: string }> },
) {
  const { id } = await routeCtx.params;
  const form = await request.formData();
  const status = String(form.get('status') ?? '');
  if (!FLOW.includes(status)) {
    return NextResponse.json({ error: 'invalid status' }, { status: 400 });
  }

  const result = await withTenantDb(async (db, ctx) => {
    if (!canUseModule(ctx.entitlements, 'recruitment')) {
      return { status: 403 as const, body: { error: 'recruitment module not entitled for this company' } };
    }
    const [cand] = await db<
      { id: string; full_name: string; email: string; status: string; vacancy_id: string }[]
    >`select id, full_name, email, status, vacancy_id from candidates where id = ${id}`;
    if (!cand) return { status: 404 as const, body: { error: 'candidate not found' } };
    if (['hired', 'rejected'].includes(cand.status)) {
      return { status: 409 as const, body: { error: `candidate already ${cand.status}` } };
    }

    if (status === 'hired') {
      const employeeNumber = String(form.get('employeeNumber') ?? '').trim();
      const basicSalary = Number(form.get('basicSalary'));
      const dateJoined = String(form.get('dateJoined') ?? '').trim();
      if (!employeeNumber || !Number.isFinite(basicSalary) || basicSalary < 0 || !dateJoined) {
        return {
          status: 400 as const,
          body: { error: 'hiring needs employeeNumber, basicSalary and dateJoined' },
        };
      }
      const [emp] = await db<{ id: string }[]>`
        insert into employees (employee_number, full_name, email, date_joined, basic_salary)
        values (${employeeNumber}, ${cand.full_name}, ${cand.email}, ${dateJoined}, ${basicSalary})
        on conflict (employee_number) do nothing returning id`;
      if (!emp) return { status: 409 as const, body: { error: 'employee number already exists' } };
      await spawnOnboarding(db, emp.id);
      await db`insert into audit_log (action, object_key, record_id, detail)
        values ('candidate.hired', 'candidate', ${id}, ${db.json({ employeeId: emp.id })})`;
      await dispatchWebhooks(db, 'employee.created', {
        id: emp.id, employeeNumber, fullName: cand.full_name, source: 'recruitment',
      });
    }

    await db`update candidates set status = ${status} where id = ${id}`;
    return { status: 200 as const, body: { id, status } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if (result.status === 200 && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/recruitment', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
