import { NextResponse, type NextRequest } from 'next/server';
import { canUseModule } from '@hr/entitlements';
import { withTenantDb } from '../../../lib/objects';

/**
 * Succession operations (L3-gated):
 *  op=role       title, impact, incumbentNumber?
 *  op=successor  roleId, employeeNumber, rank, readiness
 *  op=readiness  successorId, readiness
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const op = String(form.get('op') ?? '');

  const result = await withTenantDb(async (db, ctx) => {
    if (!canUseModule(ctx.entitlements, 'succession')) {
      return { status: 403 as const, body: { error: 'succession module not entitled for this company' } };
    }

    if (op === 'role') {
      const title = String(form.get('title') ?? '').trim();
      const impact = String(form.get('impact') ?? 'high');
      const incumbentNumber = String(form.get('incumbentNumber') ?? '').trim();
      if (!title || !['medium', 'high', 'critical'].includes(impact)) {
        return { status: 400 as const, body: { error: 'title and valid impact required' } };
      }
      let incumbentId: string | null = null;
      if (incumbentNumber) {
        const [emp] = await db<{ id: string }[]>`
          select id from employees where employee_number = ${incumbentNumber}`;
        if (!emp) return { status: 404 as const, body: { error: 'incumbent not found' } };
        incumbentId = emp.id;
      }
      const [row] = await db<{ id: string }[]>`
        insert into critical_roles (title, business_impact, incumbent_id)
        values (${title}, ${impact}, ${incumbentId}) returning id`;
      return { status: 201 as const, body: { id: row!.id } };
    }

    if (op === 'successor') {
      const roleId = String(form.get('roleId') ?? '');
      const employeeNumber = String(form.get('employeeNumber') ?? '').trim();
      const rank = String(form.get('rank') ?? 'primary');
      const readiness = String(form.get('readiness') ?? 'develop');
      const [emp] = await db<{ id: string }[]>`
        select id from employees where employee_number = ${employeeNumber} and status = 'active'`;
      if (!emp) return { status: 404 as const, body: { error: 'active employee not found' } };
      const [role] = await db<{ incumbent_id: string | null }[]>`
        select incumbent_id from critical_roles where id = ${roleId}`;
      if (!role) return { status: 404 as const, body: { error: 'role not found' } };
      if (role.incumbent_id === emp.id) {
        return { status: 409 as const, body: { error: 'incumbent cannot be their own successor' } };
      }
      const [row] = await db<{ id: string }[]>`
        insert into successors (role_id, employee_id, rank, readiness)
        values (${roleId}, ${emp.id}, ${rank}, ${readiness})
        on conflict (role_id, employee_id) do update set rank = ${rank}, readiness = ${readiness}
        returning id`;
      return { status: 201 as const, body: { id: row!.id } };
    }

    if (op === 'readiness') {
      const successorId = String(form.get('successorId') ?? '');
      const readiness = String(form.get('readiness') ?? '');
      if (!['ready-now', '1-year', '2-3-years', 'develop'].includes(readiness)) {
        return { status: 400 as const, body: { error: 'invalid readiness' } };
      }
      const [row] = await db<{ id: string }[]>`
        update successors set readiness = ${readiness} where id = ${successorId} returning id`;
      if (!row) return { status: 404 as const, body: { error: 'successor not found' } };
      return { status: 200 as const, body: { id: successorId, readiness } };
    }

    return { status: 400 as const, body: { error: 'unknown op' } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if ((result.status === 200 || result.status === 201) && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/succession', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
