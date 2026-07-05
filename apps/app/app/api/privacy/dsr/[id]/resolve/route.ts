import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_ROLE_DEFINITIONS, isAllowed, type Role } from '@hr/rbac';
import { withTenantDb } from '../../../../../../lib/objects';

/** Resolve/reject a data-subject request (hr/tenant-admin), audited. */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const form = await request.formData();
  const action = String(form.get('action') ?? 'resolve');
  const resolution = String(form.get('resolution') ?? '').trim() || null;
  const role = (String(form.get('_role') ?? 'hr') || 'hr') as Role;
  if (!['resolve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action must be resolve|reject' }, { status: 400 });
  }
  if (!isAllowed(DEFAULT_ROLE_DEFINITIONS, { role, moduleKey: 'data-privacy', action: 'update', targetScope: 'all' })) {
    return NextResponse.json({ error: `role '${role}' may not decide DSRs` }, { status: 403 });
  }

  const result = await withTenantDb(async (db) => {
    const [row] = await db<{ status: string }[]>`
      select status from data_subject_requests where id = ${id}`;
    if (!row) return { status: 404 as const, body: { error: 'not found' } };
    if (row.status !== 'open') return { status: 409 as const, body: { error: `already ${row.status}` } };
    const next = action === 'resolve' ? 'resolved' : 'rejected';
    await db`update data_subject_requests
      set status = ${next}, resolved_at = now(), resolution = ${resolution}
      where id = ${id}`;
    await db`insert into audit_log (action, object_key, record_id, detail)
      values ('dsr.decided', 'data-subject-request', ${id}, ${db.json({ decision: next, role })})`;
    return { status: 200 as const, body: { id, status: next } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if (result.status === 200 && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/privacy', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
