import { NextResponse, type NextRequest } from 'next/server';
import { withTenantDb } from '../../../lib/objects';

const TYPES = ['annual', 'casual', 'medical', 'no-pay', 'maternity', 'paternity', 'lieu', 'study', 'special', 'compassionate'];

/** File a leave request (pending until decided). */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const employeeNumber = String(form.get('employeeNumber') ?? '').trim();
  const leaveType = String(form.get('leaveType') ?? '');
  const startDate = String(form.get('startDate') ?? '');
  const endDate = String(form.get('endDate') ?? '');
  const reason = String(form.get('reason') ?? '').trim() || null;

  if (!employeeNumber || !TYPES.includes(leaveType) || !startDate || !endDate || endDate < startDate) {
    return NextResponse.json({ error: 'employeeNumber, valid leaveType and a coherent date range required' }, { status: 400 });
  }
  const days =
    Math.round((Date.parse(endDate) - Date.parse(startDate)) / 86400000) + 1;

  const result = await withTenantDb(async (db) => {
    const [emp] = await db<{ id: string }[]>`
      select id from employees where employee_number = ${employeeNumber}`;
    if (!emp) return { error: 'employee not found' };
    const [row] = await db<{ id: string }[]>`
      insert into leave_requests (employee_id, leave_type, start_date, end_date, days, reason)
      values (${emp.id}, ${leaveType}, ${startDate}, ${endDate}, ${days}, ${reason})
      returning id`;
    await db`insert into audit_log (action, object_key, record_id)
      values ('leave.requested', 'leave-request', ${row!.id})`;
    return { id: row!.id, days };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if ('error' in result) return NextResponse.json(result, { status: 400 });
  if (request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/leave', request.url), 303);
  }
  return NextResponse.json(result, { status: 201 });
}
