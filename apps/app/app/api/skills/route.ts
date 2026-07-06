import { NextResponse, type NextRequest } from 'next/server';
import { canUseModule } from '@hr/entitlements';
import { withTenantDb } from '../../../lib/objects';

/**
 * Skills Intelligence & Talent Marketplace (L3-gated):
 *  op=skill    name
 *  op=declare  skillId, employeeNumber, proficiency 1–5, verified?
 *  op=gig      title, department?, skillId?
 *  op=assign   gigId, employeeNumber   (fills the gig; matched by skill)
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const op = String(form.get('op') ?? '');

  const result = await withTenantDb(async (db, ctx) => {
    if (!canUseModule(ctx.entitlements, 'skills-intelligence')) {
      return { status: 403 as const, body: { error: 'skills intelligence module not entitled for this company' } };
    }

    if (op === 'skill') {
      const name = String(form.get('name') ?? '').trim();
      if (!name) return { status: 400 as const, body: { error: 'name required' } };
      try {
        const [row] = await db<{ id: string }[]>`insert into skills (name) values (${name}) returning id`;
        return { status: 201 as const, body: { id: row!.id } };
      } catch {
        return { status: 409 as const, body: { error: 'skill already exists' } };
      }
    }

    if (op === 'declare') {
      const skillId = String(form.get('skillId') ?? '');
      const employeeNumber = String(form.get('employeeNumber') ?? '').trim();
      const proficiency = Number(form.get('proficiency'));
      const verified = form.get('verified') === 'on' || form.get('verified') === 'true';
      if (!Number.isInteger(proficiency) || proficiency < 1 || proficiency > 5) {
        return { status: 400 as const, body: { error: 'proficiency 1–5 required' } };
      }
      const [emp] = await db<{ id: string }[]>`
        select id from employees where employee_number = ${employeeNumber} and status = 'active'`;
      if (!emp) return { status: 404 as const, body: { error: 'active employee not found' } };
      await db`insert into employee_skills (skill_id, employee_id, proficiency, verified)
        values (${skillId}, ${emp.id}, ${proficiency}, ${verified})
        on conflict (skill_id, employee_id) do update set proficiency = ${proficiency}, verified = ${verified}`;
      return { status: 201 as const, body: { ok: true } };
    }

    if (op === 'gig') {
      const title = String(form.get('title') ?? '').trim();
      if (!title) return { status: 400 as const, body: { error: 'title required' } };
      const skillId = String(form.get('skillId') ?? '') || null;
      const [row] = await db<{ id: string }[]>`
        insert into gigs (title, department, skill_id)
        values (${title}, ${String(form.get('department') ?? '') || null}, ${skillId}) returning id`;
      return { status: 201 as const, body: { id: row!.id } };
    }

    if (op === 'assign') {
      const gigId = String(form.get('gigId') ?? '');
      const employeeNumber = String(form.get('employeeNumber') ?? '').trim();
      const [emp] = await db<{ id: string }[]>`
        select id from employees where employee_number = ${employeeNumber} and status = 'active'`;
      if (!emp) return { status: 404 as const, body: { error: 'active employee not found' } };
      const [row] = await db<{ id: string }[]>`
        update gigs set assignee_id = ${emp.id}, status = 'filled'
        where id = ${gigId} and status = 'open' returning id`;
      if (!row) return { status: 409 as const, body: { error: 'gig not open' } };
      await db`insert into audit_log (action, object_key, record_id, detail)
        values ('gig.filled', 'gig', ${gigId}, ${db.json({ employeeNumber })})`;
      return { status: 200 as const, body: { id: gigId, filled: true } };
    }

    return { status: 400 as const, body: { error: 'unknown op' } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if ((result.status === 200 || result.status === 201) && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/skills', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
