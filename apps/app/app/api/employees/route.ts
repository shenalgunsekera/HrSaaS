import { NextResponse, type NextRequest } from 'next/server';
import { withTenantDb } from '../../../lib/objects';
import { dispatchWebhooks } from '../../../lib/webhooks';

/** Create an employee (typed core). Minimal L1 intake; full form via UI. */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const fullName = String(form.get('fullName') ?? '').trim();
  const employeeNumber = String(form.get('employeeNumber') ?? '').trim();
  const dateJoined = String(form.get('dateJoined') ?? '').trim();
  const basicSalary = Number(form.get('basicSalary'));
  const department = String(form.get('department') ?? '').trim() || null;
  const designation = String(form.get('designation') ?? '').trim() || null;
  const epfNumber = String(form.get('epfNumber') ?? '').trim() || null;
  const allowancesRaw = String(form.get('allowances') ?? '').trim(); // "transport:25000, meal:15000"

  if (!fullName || !employeeNumber || !dateJoined || !Number.isFinite(basicSalary) || basicSalary < 0) {
    return NextResponse.json(
      { error: 'fullName, employeeNumber, dateJoined and a non-negative basicSalary are required' },
      { status: 400 },
    );
  }
  const allowances: Record<string, number> = {};
  for (const part of allowancesRaw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [k, v] = part.split(':').map((s) => s.trim());
    const n = Number(v);
    if (!k || !Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: `bad allowance '${part}' (use name:amount)` }, { status: 400 });
    }
    allowances[k] = n;
  }

  const result = await withTenantDb(async (db) => {
    const [row] = await db<{ id: string }[]>`
      insert into employees (employee_number, full_name, date_joined, basic_salary,
                             fixed_allowances, department, designation, epf_number)
      values (${employeeNumber}, ${fullName}, ${dateJoined}, ${basicSalary},
              ${db.json(allowances as never)}, ${department}, ${designation}, ${epfNumber})
      on conflict (employee_number) do nothing
      returning id`;
    if (!row) return { error: 'employee number already exists' };
    // orchestrated onboarding: checklist spawns with the hire
    const onboarding: Array<[string, string]> = [
      ['Collect NIC / passport copy', 'documents'],
      ['Signed employment contract on file', 'documents'],
      ['EPF/ETF registration submitted', 'statutory'],
      ['Bank account details verified', 'payroll'],
      ['Record privacy consents', 'privacy'],
      ['Issue assets (laptop, access card…)', 'assets'],
      ['System access provisioned', 'it'],
      ['Assign buddy & induction session', 'experience'],
    ];
    for (let i = 0; i < onboarding.length; i++) {
      await db`insert into lifecycle_tasks (employee_id, kind, task, category, display_order)
        values (${row.id}, 'onboarding', ${onboarding[i]![0]}, ${onboarding[i]![1]}, ${i})`;
    }
    await db`insert into audit_log (action, object_key, record_id)
      values ('employee.created', 'employee', ${row.id})`;
    await dispatchWebhooks(db, 'employee.created', { id: row.id, employeeNumber, fullName });
    return { id: row.id };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if ('error' in result) return NextResponse.json(result, { status: 400 });
  if (request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/employees', request.url), 303);
  }
  return NextResponse.json(result, { status: 201 });
}
