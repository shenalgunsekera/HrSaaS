import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_ROLE_DEFINITIONS, isAllowed, type Role } from '@hr/rbac';
import { withTenantDb } from '../../../../../lib/objects';

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
    const [row] = await db<{ id: string; status: string }[]>`
      select id, status from leave_requests where id = ${id}`;
    if (!row) return { status: 404 as const, body: { error: 'not found' } };
    if (row.status !== 'pending') {
      return { status: 409 as const, body: { error: `already ${row.status}` } };
    }
    const next = action === 'approve' ? 'approved' : 'rejected';
    await db`update leave_requests set status = ${next} where id = ${id}`;
    await db`insert into audit_log (action, object_key, record_id, detail)
      values ('leave.decided', 'leave-request', ${id}, ${db.json({ decision: next, role })})`;
    return { status: 200 as const, body: { id, status: next } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if (result.status === 200 && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/leave', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
