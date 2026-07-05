import { NextResponse, type NextRequest } from 'next/server';
import { withTenantDb } from '../../../lib/objects';

const STATUSES = ['present', 'absent', 'late', 'half-day', 'leave'];

/** Mark/overwrite one attendance day for an employee (manual capture source). */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const employeeNumber = String(form.get('employeeNumber') ?? '').trim();
  const day = String(form.get('day') ?? '').trim();
  const status = String(form.get('status') ?? 'present');
  const clockIn = String(form.get('clockIn') ?? '').trim() || null;
  const clockOut = String(form.get('clockOut') ?? '').trim() || null;

  if (!employeeNumber || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !STATUSES.includes(status)) {
    return NextResponse.json({ error: 'employeeNumber, day (YYYY-MM-DD) and a valid status required' }, { status: 400 });
  }

  const result = await withTenantDb(async (db) => {
    const [emp] = await db<{ id: string }[]>`
      select id from employees where employee_number = ${employeeNumber}`;
    if (!emp) return { error: 'employee not found' };
    await db`insert into attendance_records (employee_id, day, status, clock_in, clock_out, source)
      values (${emp.id}, ${day}, ${status}, ${clockIn}, ${clockOut}, 'manual')
      on conflict (employee_id, day) do update
        set status = excluded.status, clock_in = excluded.clock_in,
            clock_out = excluded.clock_out, source = 'manual'`;
    return { ok: true };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if ('error' in result) return NextResponse.json(result, { status: 400 });
  if (request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL(`/attendance?month=${day.slice(0, 7)}`, request.url), 303);
  }
  return NextResponse.json(result, { status: 201 });
}
