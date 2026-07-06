import { NextResponse, type NextRequest } from 'next/server';
import { canUseModule } from '@hr/entitlements';
import { withTenantDb } from '../../../lib/objects';

/**
 * Competency operations (L3-gated):
 *  op=competency   name, category
 *  op=requirement  competencyId, designation, requiredLevel 1–5
 *  op=assess       competencyId, employeeNumber, level 1–5
 * Gap analysis (required − actual) is computed at read time.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const op = String(form.get('op') ?? '');

  const result = await withTenantDb(async (db, ctx) => {
    if (!canUseModule(ctx.entitlements, 'competency')) {
      return { status: 403 as const, body: { error: 'competency module not entitled for this company' } };
    }

    if (op === 'competency') {
      const name = String(form.get('name') ?? '').trim();
      const category = String(form.get('category') ?? 'functional');
      if (!name || !['core', 'functional', 'leadership', 'technical', 'behavioural'].includes(category)) {
        return { status: 400 as const, body: { error: 'name and valid category required' } };
      }
      try {
        const [row] = await db<{ id: string }[]>`
          insert into competencies (name, category) values (${name}, ${category}) returning id`;
        return { status: 201 as const, body: { id: row!.id } };
      } catch {
        return { status: 409 as const, body: { error: 'competency already exists' } };
      }
    }

    if (op === 'requirement') {
      const competencyId = String(form.get('competencyId') ?? '');
      const designation = String(form.get('designation') ?? '').trim();
      const requiredLevel = Number(form.get('requiredLevel'));
      if (!designation || !Number.isInteger(requiredLevel) || requiredLevel < 1 || requiredLevel > 5) {
        return { status: 400 as const, body: { error: 'designation and requiredLevel 1–5 required' } };
      }
      await db`insert into competency_requirements (competency_id, designation, required_level)
        values (${competencyId}, ${designation}, ${requiredLevel})
        on conflict (competency_id, designation) do update set required_level = ${requiredLevel}`;
      return { status: 201 as const, body: { ok: true } };
    }

    if (op === 'assess') {
      const competencyId = String(form.get('competencyId') ?? '');
      const employeeNumber = String(form.get('employeeNumber') ?? '').trim();
      const level = Number(form.get('level'));
      if (!Number.isInteger(level) || level < 1 || level > 5) {
        return { status: 400 as const, body: { error: 'level 1–5 required' } };
      }
      const [emp] = await db<{ id: string }[]>`
        select id from employees where employee_number = ${employeeNumber} and status = 'active'`;
      if (!emp) return { status: 404 as const, body: { error: 'active employee not found' } };
      await db`insert into competency_assessments (competency_id, employee_id, level, assessed_at)
        values (${competencyId}, ${emp.id}, ${level}, now())
        on conflict (competency_id, employee_id) do update set level = ${level}, assessed_at = now()`;
      return { status: 201 as const, body: { ok: true } };
    }

    return { status: 400 as const, body: { error: 'unknown op' } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if (result.status === 201 && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/competency', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
