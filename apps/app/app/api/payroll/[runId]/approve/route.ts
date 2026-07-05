import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_ROLE_DEFINITIONS, isAllowed, type Role } from '@hr/rbac';
import { withTenantDb } from '../../../../../lib/objects';

/** Approve a draft payroll run — locks it against re-runs. Audited. */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ runId: string }> },
) {
  const { runId } = await ctx.params;
  const form = await request.formData();
  const role = (String(form.get('_role') ?? 'payroll-admin') || 'payroll-admin') as Role;
  if (
    !isAllowed(DEFAULT_ROLE_DEFINITIONS, {
      role,
      moduleKey: 'payroll',
      action: 'approve',
      targetScope: 'all',
    })
  ) {
    return NextResponse.json({ error: `role '${role}' may not approve payroll` }, { status: 403 });
  }

  const result = await withTenantDb(async (db) => {
    const [run] = await db<{ status: string }[]>`
      select status from payroll_runs where id = ${runId}`;
    if (!run) return { status: 404 as const, body: { error: 'run not found' } };
    if (run.status !== 'draft') return { status: 409 as const, body: { error: `run is ${run.status}` } };
    await db`update payroll_runs set status = 'approved', approved_at = now() where id = ${runId}`;
    // Finalize advance/loan recoveries recorded on this run's payslips.
    const slips = await db<{ detail: { recoveries?: Array<{ id: string; amount: number }> } }[]>`
      select detail from payslips where run_id = ${runId}`;
    for (const s of slips) {
      for (const r of s.detail?.recoveries ?? []) {
        await db`update advances set
            outstanding = greatest(0, outstanding - ${r.amount}),
            status = case when outstanding - ${r.amount} <= 0 then 'settled' else status end
          where id = ${r.id} and status = 'active'`;
      }
    }
    await db`insert into audit_log (action, object_key, record_id, detail)
      values ('payroll.run_approved', 'payroll-run', ${runId}, ${db.json({ role })})`;
    return { status: 200 as const, body: { runId, status: 'approved' } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if (result.status === 200 && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/payroll', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
