import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_ROLE_DEFINITIONS, isAllowed, type Role } from '@hr/rbac';
import { withTenantDb } from '../../../../../../lib/objects';

/**
 * Responsible-lending rules (feature sheet F: max advance-to-salary ratio):
 * advances capped at 50% of monthly basic; loan installments capped at 25%
 * of monthly basic. Tenant-configurable policy later; enforced here.
 */
const MAX_ADVANCE_TO_BASIC = 0.5;
const MAX_INSTALLMENT_TO_BASIC = 0.25;

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const form = await request.formData();
  const action = String(form.get('action') ?? '');
  const role = (String(form.get('_role') ?? 'hr') || 'hr') as Role;
  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action must be approve|reject' }, { status: 400 });
  }
  if (!isAllowed(DEFAULT_ROLE_DEFINITIONS, { role, moduleKey: 'financial-wellness', action: 'approve', targetScope: 'all' })) {
    return NextResponse.json({ error: `role '${role}' may not decide advances` }, { status: 403 });
  }

  const result = await withTenantDb(async (db) => {
    const [row] = await db<
      { status: string; kind: string; principal: string; monthly_installment: string; basic_salary: string }[]
    >`select a.status, a.kind, a.principal, a.monthly_installment, e.basic_salary
      from advances a join employees e on e.id = a.employee_id where a.id = ${id}`;
    if (!row) return { status: 404 as const, body: { error: 'not found' } };
    if (row.status !== 'pending') return { status: 409 as const, body: { error: `already ${row.status}` } };

    if (action === 'approve') {
      const basic = Number(row.basic_salary);
      if (row.kind === 'advance' && Number(row.principal) > basic * MAX_ADVANCE_TO_BASIC) {
        return { status: 409 as const, body: { error: `advance exceeds ${MAX_ADVANCE_TO_BASIC * 100}% of basic (max ${basic * MAX_ADVANCE_TO_BASIC})` } };
      }
      if (row.kind === 'loan' && Number(row.monthly_installment) > basic * MAX_INSTALLMENT_TO_BASIC) {
        return { status: 409 as const, body: { error: `installment exceeds ${MAX_INSTALLMENT_TO_BASIC * 100}% of basic (max ${basic * MAX_INSTALLMENT_TO_BASIC})` } };
      }
    }
    const next = action === 'approve' ? 'active' : 'rejected';
    await db`update advances set status = ${next}, approved_at = case when ${next} = 'active' then now() end where id = ${id}`;
    await db`insert into audit_log (action, object_key, record_id, detail)
      values ('advance.decided', 'advance', ${id}, ${db.json({ decision: next, role })})`;
    return { status: 200 as const, body: { id, status: next } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if (result.status === 200 && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/wellness', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
