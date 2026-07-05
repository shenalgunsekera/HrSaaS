import { NextResponse, type NextRequest } from 'next/server';
import { withTenantDb } from '../../../../lib/objects';

const KINDS = ['access', 'correction', 'erasure', 'portability'];
const SLA_DAYS = 30; // PDPA turnaround default (ADR-0007 §8)

/** File a data-subject request; due date = filing + 30 days. */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const employeeNumber = String(form.get('employeeNumber') ?? '').trim();
  const kind = String(form.get('kind') ?? '');
  const detail = String(form.get('detail') ?? '').trim() || null;
  if (!employeeNumber || !KINDS.includes(kind)) {
    return NextResponse.json({ error: 'employeeNumber and a valid kind required' }, { status: 400 });
  }

  const result = await withTenantDb(async (db) => {
    const [emp] = await db<{ id: string }[]>`
      select id from employees where employee_number = ${employeeNumber}`;
    if (!emp) return { error: 'employee not found' };
    const [row] = await db<{ id: string; due_at: string }[]>`
      insert into data_subject_requests (employee_id, kind, detail, due_at)
      values (${emp.id}, ${kind}, ${detail}, now() + ${SLA_DAYS + ' days'}::interval)
      returning id, due_at::text`;
    await db`insert into audit_log (action, object_key, record_id, detail)
      values ('dsr.filed', 'data-subject-request', ${row!.id}, ${db.json({ kind })})`;
    return { id: row!.id, dueAt: row!.due_at };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if ('error' in result) return NextResponse.json(result, { status: 400 });
  if (request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/privacy', request.url), 303);
  }
  return NextResponse.json(result, { status: 201 });
}
