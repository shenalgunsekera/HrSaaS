import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_ROLE_DEFINITIONS, isAllowed, type Role } from '@hr/rbac';
import { withTenantDb } from '../../../lib/objects';

/**
 * Disciplinary & Grievance (legally sensitive, tightly access-controlled).
 * Not a tier module — available at every level, but restricted by RBAC to
 * HR and tenant-admin only. Managers/employees are refused. This is the
 * access-control point the domain review flagged: confidential case records.
 *
 *  op=open   kind, employeeNumber, summary, severity
 *  op=note   caseId, note
 *  op=close  caseId, outcome
 */
const CAN_ACCESS: Role[] = ['hr', 'tenant-admin'];

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const op = String(form.get('op') ?? '');
  const role = (String(form.get('_role') ?? 'hr') || 'hr') as Role;

  // Access control: employee-relations records are HR/tenant-admin only.
  if (!CAN_ACCESS.includes(role) ||
      !isAllowed(DEFAULT_ROLE_DEFINITIONS, { role, moduleKey: 'employee-master', action: 'update', targetScope: 'all' })) {
    return NextResponse.json({ error: `role '${role}' may not access employee relations cases` }, { status: 403 });
  }

  const result = await withTenantDb(async (db) => {
    if (op === 'open') {
      const kind = String(form.get('kind') ?? '');
      const employeeNumber = String(form.get('employeeNumber') ?? '').trim();
      const summary = String(form.get('summary') ?? '').trim();
      const severity = String(form.get('severity') ?? 'minor');
      if (!['disciplinary', 'grievance'].includes(kind) || !summary ||
          !['minor', 'major', 'gross'].includes(severity)) {
        return { status: 400 as const, body: { error: 'valid kind, summary and severity required' } };
      }
      const [emp] = await db<{ id: string }[]>`
        select id from employees where employee_number = ${employeeNumber}`;
      if (!emp) return { status: 404 as const, body: { error: 'employee not found' } };
      const caseNumber = `${kind === 'disciplinary' ? 'DISC' : 'GRV'}-${Date.now().toString(36).toUpperCase()}`;
      const [row] = await db<{ id: string }[]>`
        insert into cases (case_number, kind, employee_id, summary, severity, opened_by)
        values (${caseNumber}, ${kind}, ${emp.id}, ${summary}, ${severity}, ${role})
        returning id`;
      await db`insert into audit_log (action, object_key, record_id, detail)
        values ('case.opened', 'case', ${row!.id}, ${db.json({ kind, severity, role })})`;
      return { status: 201 as const, body: { id: row!.id, caseNumber } };
    }

    if (op === 'note') {
      const caseId = String(form.get('caseId') ?? '');
      const note = String(form.get('note') ?? '').trim();
      if (!note) return { status: 400 as const, body: { error: 'note required' } };
      const [c] = await db<{ status: string }[]>`select status from cases where id = ${caseId}`;
      if (!c) return { status: 404 as const, body: { error: 'case not found' } };
      await db`insert into case_notes (case_id, note, author) values (${caseId}, ${note}, ${role})`;
      await db`update cases set status = case when status = 'open' then 'investigating' else status end
        where id = ${caseId}`;
      return { status: 201 as const, body: { ok: true } };
    }

    if (op === 'close') {
      const caseId = String(form.get('caseId') ?? '');
      const outcome = String(form.get('outcome') ?? '').trim();
      if (!outcome) return { status: 400 as const, body: { error: 'outcome required' } };
      const [row] = await db<{ id: string }[]>`
        update cases set status = 'closed', outcome = ${outcome}, closed_at = now()
        where id = ${caseId} and status <> 'closed' returning id`;
      if (!row) return { status: 409 as const, body: { error: 'case not found or already closed' } };
      await db`insert into audit_log (action, object_key, record_id, detail)
        values ('case.closed', 'case', ${caseId}, ${db.json({ role })})`;
      return { status: 200 as const, body: { id: caseId, closed: true } };
    }

    return { status: 400 as const, body: { error: 'unknown op' } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if ((result.status === 200 || result.status === 201) && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/cases', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
