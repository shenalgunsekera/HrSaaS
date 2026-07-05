import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_ROLE_DEFINITIONS, isAllowed, type Role } from '@hr/rbac';
import { withTenantDb } from '../../../../../lib/objects';
import { dispatchWebhooks } from '../../../../../lib/webhooks';

/**
 * Approve/reject a pending leave request. RBAC gate: role must hold
 * leave:approve (manager = team scope, hr/tenant-admin = all). Approval is
 * what makes no-pay leave count in payroll — the decision is audited.
 */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const form = await request.formData();
  const action = String(form.get('action') ?? '');
  const role = (String(form.get('_role') ?? 'manager') || 'manager') as Role;
  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action must be approve|reject' }, { status: 400 });
  }
  if (
    !isAllowed(DEFAULT_ROLE_DEFINITIONS, {
      role,
      moduleKey: 'leave',
      action: 'approve',
      targetScope: 'team',
    })
  ) {
    return NextResponse.json({ error: `role '${role}' may not decide leave` }, { status: 403 });
  }

  const result = await withTenantDb(async (db) => {
    const [row] = await db<
      { id: string; status: string; employee_id: string; leave_type: string;
        days: string; start_date: string }[]
    >`select id, status, employee_id, leave_type, days,
        to_char(start_date,'YYYY') as start_date
      from leave_requests where id = ${id}`;
    if (!row) return { status: 404 as const, body: { error: 'not found' } };
    if (row.status !== 'pending') {
      return { status: 409 as const, body: { error: `already ${row.status}` } };
    }

    // Entitlement rule: entitled types cannot exceed the annual policy balance
    // (no-pay is by definition unentitled and always allowed).
    if (action === 'approve' && row.leave_type !== 'no-pay') {
      const [policy] = await db<{ annual_days: string }[]>`
        select annual_days from leave_policies where leave_type = ${row.leave_type}`;
      const entitled = Number(policy?.annual_days ?? 0);
      const [{ used }] = await db<[{ used: string }]>`
        select coalesce(sum(days), 0)::text as used from leave_requests
        where employee_id = ${row.employee_id} and leave_type = ${row.leave_type}
          and status = 'approved'
          and to_char(start_date,'YYYY') = ${row.start_date}`;
      const remaining = entitled - Number(used);
      if (Number(row.days) > remaining) {
        return {
          status: 409 as const,
          body: {
            error: `insufficient ${row.leave_type} balance: ${remaining} of ${entitled} day(s) remaining this year`,
          },
        };
      }
    }
    const next = action === 'approve' ? 'approved' : 'rejected';
    await db`update leave_requests set status = ${next} where id = ${id}`;
    await db`insert into audit_log (action, object_key, record_id, detail)
      values ('leave.decided', 'leave-request', ${id}, ${db.json({ decision: next, role })})`;
    await dispatchWebhooks(db, 'leave.decided', { id, status: next });
    return { status: 200 as const, body: { id, status: next } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if (result.status === 200 && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/leave', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
