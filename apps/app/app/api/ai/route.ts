import { NextResponse, type NextRequest } from 'next/server';
import { canUseModule } from '@hr/entitlements';
import { DEFAULT_ROLE_DEFINITIONS, isAllowed, type Role } from '@hr/rbac';
import { withTenantDb } from '../../../lib/objects';
import type postgres from 'postgres';

/**
 * AI Assistant & Agent Orchestration (L5) with governance.
 *
 *  op=ask       question  → grounded answer over THIS tenant's data, with the
 *               data sources it used (explainability). Deterministic and
 *               tenant-scoped; a hosted-LLM adapter plugs in here later (same
 *               pattern as the scheduler/payment adapters) but grounding on
 *               the tenant's own DB stays mandatory.
 *  op=propose   agent, intent  → creates an agent task in awaiting_approval.
 *  op=approve   taskId  → human-in-the-loop gate; executes the action, audits.
 *  op=reject    taskId
 *
 * No agent action ever executes without a human approving it first.
 */

const CAN_APPROVE: Role[] = ['hr', 'tenant-admin'];

/** Intent-routed, data-grounded assistant. Returns answer + sources used. */
async function answer(db: ReturnType<typeof postgres>, q: string) {
  const t = q.toLowerCase();
  const sources: string[] = [];
  let a = '';

  if (/(head ?count|how many (employees|staff)|total employees)/.test(t)) {
    const [{ n }] = await db<[{ n: number }]>`select count(*)::int n from employees where status='active'`;
    sources.push('employees');
    a = `There are ${n} active employees.`;
  } else if (/(on leave|who.*leave|leave today)/.test(t)) {
    const rows = await db<{ full_name: string }[]>`
      select e.full_name from leave_requests l join employees e on e.id = l.employee_id
      where l.status='approved' and current_date between l.start_date and l.end_date`;
    sources.push('leave_requests', 'employees');
    a = rows.length ? `On leave today: ${rows.map((r) => r.full_name).join(', ')}.` : 'Nobody is on approved leave today.';
  } else if (/(payroll|net pay|salary cost|last payroll)/.test(t)) {
    const [r] = await db<{ period: string; net: string }[]>`
      select period, totals->>'net' as net from payroll_runs order by period desc limit 1`;
    sources.push('payroll_runs');
    a = r ? `The latest payroll (${r.period}) had a net payout of LKR ${Number(r.net).toLocaleString()}.` : 'No payroll has been run yet.';
  } else if (/(attrition|turnover|who.*leaving|exits?)/.test(t)) {
    const [{ n }] = await db<[{ n: number }]>`select count(*)::int n from final_settlements where last_day >= current_date - 90`;
    sources.push('final_settlements');
    a = `${n} employee(s) have exited in the last 90 days.`;
  } else if (/(open case|disciplinary|grievance|relations)/.test(t)) {
    const [{ n }] = await db<[{ n: number }]>`select count(*)::int n from cases where status <> 'closed'`;
    sources.push('cases');
    a = `There are ${n} open employee-relations case(s).`;
  } else if (/(expir|certificat|training)/.test(t)) {
    const [{ n }] = await db<[{ n: number }]>`
      select count(*)::int n from enrollments where status='completed' and expires_at is not null and expires_at <= current_date + 60`;
    sources.push('enrollments', 'courses');
    a = `${n} certificate(s) expire within 60 days.`;
  } else {
    a = "I can answer questions grounded in this company's data — try headcount, who's on leave, latest payroll, attrition, open cases, or expiring certificates.";
  }
  return { a, sources };
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const op = String(form.get('op') ?? '');
  const role = (String(form.get('_role') ?? 'hr') || 'hr') as Role;

  const result = await withTenantDb(async (db, ctx) => {
    if (!canUseModule(ctx.entitlements, 'ai-assistant')) {
      return { status: 403 as const, body: { error: 'AI assistant module not entitled for this company' } };
    }

    if (op === 'ask') {
      const question = String(form.get('question') ?? '').trim();
      if (!question) return { status: 400 as const, body: { error: 'question required' } };
      const { a, sources } = await answer(db, question);
      await db`insert into ai_queries (question, answer, grounded_on, asked_by)
        values (${question}, ${a}, ${db.json(sources)}, ${role})`;
      return { status: 201 as const, body: { answer: a, grounded_on: sources } };
    }

    if (op === 'propose') {
      const agent = String(form.get('agent') ?? '');
      const intent = String(form.get('intent') ?? '').trim();
      if (!['advisor', 'engagement'].includes(agent) || !intent) {
        return { status: 400 as const, body: { error: 'valid agent and intent required' } };
      }
      // Simulate the proposed action before execution (no side effects yet).
      let proposed: Record<string, unknown>;
      if (agent === 'engagement') {
        proposed = { action: 'launch_pulse_survey', question: intent };
      } else {
        const [{ n }] = await db<[{ n: number }]>`select count(*)::int n from employees where status='active'`;
        proposed = { action: 'advisory_summary', note: intent, context: { activeHeadcount: n } };
      }
      const [row] = await db<{ id: string }[]>`
        insert into agent_tasks (agent, intent, proposed_action)
        values (${agent}, ${intent}, ${db.json(proposed as never)}) returning id`;
      await db`insert into audit_log (action, object_key, record_id, detail)
        values ('agent.proposed', 'agent-task', ${row!.id}, ${db.json({ agent, role })})`;
      return { status: 201 as const, body: { id: row!.id, awaiting_approval: true } };
    }

    if (op === 'approve' || op === 'reject') {
      // Governance: human-in-the-loop — only HR/tenant-admin may decide.
      if (!CAN_APPROVE.includes(role) ||
          !isAllowed(DEFAULT_ROLE_DEFINITIONS, { role, moduleKey: 'ai-assistant', action: 'approve', targetScope: 'all' })) {
        return { status: 403 as const, body: { error: `role '${role}' may not approve agent actions` } };
      }
      const taskId = String(form.get('taskId') ?? '');
      const [task] = await db<
        { id: string; agent: string; status: string; proposed_action: Record<string, unknown> }[]
      >`select id, agent, status, proposed_action from agent_tasks where id = ${taskId}`;
      if (!task) return { status: 404 as const, body: { error: 'task not found' } };
      if (task.status !== 'awaiting_approval') return { status: 409 as const, body: { error: `task is ${task.status}` } };

      if (op === 'reject') {
        await db`update agent_tasks set status='rejected', approved_by=${role} where id=${taskId}`;
        await db`insert into audit_log (action, object_key, record_id, detail)
          values ('agent.rejected', 'agent-task', ${taskId}, ${db.json({ role })})`;
        return { status: 200 as const, body: { id: taskId, status: 'rejected' } };
      }

      // Approved → execute the (previously simulated) action, then record result.
      let resultText = '';
      const pa = task.proposed_action;
      if (pa.action === 'launch_pulse_survey') {
        await db`insert into surveys (question, anonymous) values (${String(pa.question)}, true)`;
        resultText = 'Pulse survey launched.';
      } else {
        resultText = `Advisory: ${String(pa.note)} (context: ${JSON.stringify(pa.context)})`;
      }
      await db`update agent_tasks set status='executed', approved_by=${role},
        executed_at=now(), result=${resultText} where id=${taskId}`;
      await db`insert into audit_log (action, object_key, record_id, detail)
        values ('agent.executed', 'agent-task', ${taskId}, ${db.json({ role, action: String(pa.action) })})`;
      return { status: 200 as const, body: { id: taskId, status: 'executed', result: resultText } };
    }

    return { status: 400 as const, body: { error: 'unknown op' } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if ((result.status === 200 || result.status === 201) && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/ai', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
