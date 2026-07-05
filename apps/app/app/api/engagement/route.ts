import { NextResponse, type NextRequest } from 'next/server';
import { canUseModule } from '@hr/entitlements';
import { withTenantDb } from '../../../lib/objects';

/**
 * Engagement operations (L2-gated):
 *  op=survey   question, anonymous?
 *  op=respond  surveyId, score 0–10, employeeNumber? (omitted when anonymous)
 *  op=close    surveyId
 * eNPS = %promoters(9–10) − %detractors(0–6), computed at read time.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const op = String(form.get('op') ?? '');

  const result = await withTenantDb(async (db, ctx) => {
    if (!canUseModule(ctx.entitlements, 'experience-engagement')) {
      return { status: 403 as const, body: { error: 'engagement module not entitled for this company' } };
    }

    if (op === 'survey') {
      const question = String(form.get('question') ?? '').trim();
      if (!question) return { status: 400 as const, body: { error: 'question required' } };
      const [row] = await db<{ id: string }[]>`
        insert into surveys (question, anonymous)
        values (${question}, ${form.get('anonymous') !== 'off'}) returning id`;
      return { status: 201 as const, body: { id: row!.id } };
    }

    if (op === 'respond') {
      const surveyId = String(form.get('surveyId') ?? '');
      const score = Number(form.get('score'));
      const comment = String(form.get('comment') ?? '').trim() || null;
      const employeeNumber = String(form.get('employeeNumber') ?? '').trim();
      if (!Number.isInteger(score) || score < 0 || score > 10) {
        return { status: 400 as const, body: { error: 'score 0–10 required' } };
      }
      const [survey] = await db<{ anonymous: boolean; closed_at: string | null }[]>`
        select anonymous, closed_at from surveys where id = ${surveyId}`;
      if (!survey) return { status: 404 as const, body: { error: 'survey not found' } };
      if (survey.closed_at) return { status: 409 as const, body: { error: 'survey closed' } };
      let employeeId: string | null = null;
      if (!survey.anonymous) {
        const [emp] = await db<{ id: string }[]>`
          select id from employees where employee_number = ${employeeNumber}`;
        if (!emp) return { status: 400 as const, body: { error: 'named survey needs a valid employeeNumber' } };
        employeeId = emp.id;
      }
      try {
        await db`insert into survey_responses (survey_id, employee_id, score, comment)
          values (${surveyId}, ${employeeId}, ${score}, ${comment})`;
      } catch {
        return { status: 409 as const, body: { error: 'already responded' } };
      }
      return { status: 201 as const, body: { ok: true } };
    }

    if (op === 'close') {
      const surveyId = String(form.get('surveyId') ?? '');
      const [row] = await db<{ id: string }[]>`
        update surveys set closed_at = now() where id = ${surveyId} and closed_at is null returning id`;
      if (!row) return { status: 409 as const, body: { error: 'not found or already closed' } };
      return { status: 200 as const, body: { id: surveyId, closed: true } };
    }

    return { status: 400 as const, body: { error: 'unknown op' } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if ((result.status === 200 || result.status === 201) && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/engagement', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
