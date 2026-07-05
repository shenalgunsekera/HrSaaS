import { NextResponse, type NextRequest } from 'next/server';
import { withTenantDb } from '../../../../lib/objects';

/** Request a salary advance or loan (pending until decided). */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const employeeNumber = String(form.get('employeeNumber') ?? '').trim();
  const kind = String(form.get('kind') ?? 'advance');
  const principal = Number(form.get('principal'));
  const installment = Number(form.get('installment'));
  const reason = String(form.get('reason') ?? '').trim() || null;

  if (!employeeNumber || !['advance', 'loan'].includes(kind) ||
      !Number.isFinite(principal) || principal <= 0 ||
      !Number.isFinite(installment) || installment <= 0 || installment > principal) {
    return NextResponse.json({ error: 'employeeNumber, kind advance|loan, positive principal and installment ≤ principal required' }, { status: 400 });
  }

  const result = await withTenantDb(async (db) => {
    const [emp] = await db<{ id: string }[]>`
      select id from employees where employee_number = ${employeeNumber} and status = 'active'`;
    if (!emp) return { error: 'active employee not found' };
    const [row] = await db<{ id: string }[]>`
      insert into advances (employee_id, kind, principal, monthly_installment, outstanding, reason)
      values (${emp.id}, ${kind}, ${principal}, ${installment}, ${principal}, ${reason})
      returning id`;
    await db`insert into audit_log (action, object_key, record_id)
      values ('advance.requested', 'advance', ${row!.id})`;
    return { id: row!.id };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if ('error' in result) return NextResponse.json(result, { status: 400 });
  if (request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/wellness', request.url), 303);
  }
  return NextResponse.json(result, { status: 201 });
}
