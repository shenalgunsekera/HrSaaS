import { NextResponse, type NextRequest } from 'next/server';
import { withTenantDb } from '../../../../lib/objects';

const PURPOSES = ['hr-administration', 'payroll-processing', 'statutory-reporting', 'communications', 'analytics'];

/** Record a consent grant or withdrawal (purpose-based, audited). */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const employeeNumber = String(form.get('employeeNumber') ?? '').trim();
  const purpose = String(form.get('purpose') ?? '');
  const action = String(form.get('action') ?? 'grant');
  if (!employeeNumber || !PURPOSES.includes(purpose) || !['grant', 'withdraw'].includes(action)) {
    return NextResponse.json({ error: 'employeeNumber, valid purpose and action grant|withdraw required' }, { status: 400 });
  }

  const result = await withTenantDb(async (db) => {
    const [emp] = await db<{ id: string }[]>`
      select id from employees where employee_number = ${employeeNumber}`;
    if (!emp) return { error: 'employee not found' };
    if (action === 'grant') {
      await db`insert into consents (employee_id, purpose)
        values (${emp.id}, ${purpose})
        on conflict (employee_id, purpose)
        do update set granted_at = now(), withdrawn_at = null`;
    } else {
      await db`update consents set withdrawn_at = now()
        where employee_id = ${emp.id} and purpose = ${purpose} and withdrawn_at is null`;
    }
    await db`insert into audit_log (action, object_key, detail)
      values (${'consent.' + action}, 'consent', ${db.json({ employeeNumber, purpose })})`;
    return { ok: true };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if ('error' in result) return NextResponse.json(result, { status: 400 });
  if (request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/privacy', request.url), 303);
  }
  return NextResponse.json(result, { status: 201 });
}
