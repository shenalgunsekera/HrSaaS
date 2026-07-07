import { canUseModule } from '@hr/entitlements';
import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';

export const dynamic = 'force-dynamic';

const input =
  'rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand';

/** AI Assistant & Agent Orchestration (L5) — grounded Q&A + governed agents. */
export default async function AiPage() {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  if (!canUseModule(ctx.entitlements, 'ai-assistant')) {
    return (
      <main className="min-h-svh flex items-center justify-center px-6">
        <p className="font-body text-sm text-mute-2 max-w-md text-center">
          AI Assistant &amp; Agent Orchestration is available at level L5. Your company runs {ctx.tier}.
        </p>
      </main>
    );
  }

  const data = await withTenantDb(async (db) => {
    const queries = await db<
      { question: string; answer: string; grounded_on: string[]; created_at: string }[]
    >`select question, answer, grounded_on,
        to_char(created_at,'YYYY-MM-DD HH24:MI') as created_at
      from ai_queries order by created_at desc limit 10`;
    const tasks = await db<
      { id: string; agent: string; intent: string; status: string; result: string | null;
        approved_by: string | null }[]
    >`select id, agent, intent, status, result, approved_by
      from agent_tasks order by created_at desc limit 20`;
    return { queries, tasks };
  });

  const awaiting = data!.tasks.filter((t) => t.status === 'awaiting_approval');

  return (
    <main className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
          AI Assistant &amp; Agent Orchestration · {ctx.slug}
        </p>
        <div className="flex flex-wrap items-center gap-4 mb-2">
          <h1 className="text-3xl font-bold tracking-tight text-chalk">AI Assistant</h1>
        </div>
        <p className="font-body text-xs text-mute-3 mb-8 flex items-center gap-2">
          <span className="inline-block px-2 py-0.5 rounded bg-brand-50 text-brand font-semibold">GOVERNED</span>
          Answers are grounded in this company&apos;s own data. Agent actions never execute without human approval; every step is audited.
        </p>

        {/* grounded assistant */}
        <section className="rounded-lg border border-line bg-surface p-5 mb-8">
          <form method="post" action="/api/ai" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="op" value="ask" />
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1 flex-1 min-w-72">
              Ask the assistant
              <input name="question" required placeholder="How many employees are on leave today?" className={input} />
            </label>
            <button type="submit" className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-600 transition-colors">Ask</button>
          </form>
          <div className="mt-4 space-y-2">
            {data!.queries.length === 0 && <p className="font-heading italic text-mute-3 text-sm">No questions yet. Try: headcount, who&apos;s on leave, latest payroll, attrition, open cases.</p>}
            {data!.queries.map((q, i) => (
              <div key={i} className="rounded-md border border-line bg-ink px-4 py-3">
                <p className="text-xs text-mute-3 mb-1">{q.question}</p>
                <p className="text-sm text-chalk">{q.answer}</p>
                {q.grounded_on.length > 0 && (
                  <p className="text-[10px] text-mute-3 mt-1">grounded on: {q.grounded_on.join(', ')}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* agent orchestration */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <form method="post" action="/api/ai" className="rounded-lg border border-line bg-surface p-5 flex flex-col gap-3">
            <input type="hidden" name="op" value="propose" />
            <span className="text-xs font-semibold text-mute-1">Task an agent (proposes — needs approval)</span>
            <select name="agent" className={input}>
              <option value="advisor">Advisor — insight/recommendation</option>
              <option value="engagement">Engagement — launch a pulse survey</option>
            </select>
            <input name="intent" required placeholder="e.g. launch survey question, or advisory note" className={input} />
            <button type="submit" className="px-4 py-2.5 border border-brand text-brand text-sm font-medium rounded-md hover:bg-brand hover:text-white transition-colors self-start">Propose action</button>
          </form>

          <div className="rounded-lg border border-line bg-ink p-5">
            <p className="text-xs font-semibold text-mute-1 mb-3">
              Awaiting human approval {awaiting.length > 0 && <span className="text-amber-600">({awaiting.length})</span>}
            </p>
            {awaiting.length === 0 && <p className="font-heading italic text-mute-3 text-sm">Nothing pending.</p>}
            <div className="space-y-2">
              {awaiting.map((t) => (
                <div key={t.id} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
                  <p className="text-xs font-semibold text-chalk">{t.agent}: {t.intent}</p>
                  <div className="flex gap-2 mt-2">
                    <form method="post" action="/api/ai">
                      <input type="hidden" name="op" value="approve" />
                      <input type="hidden" name="_role" value="hr" />
                      <input type="hidden" name="taskId" value={t.id} />
                      <button type="submit" className="px-3 py-1 text-xs font-semibold rounded bg-brand text-white hover:bg-brand-600">approve &amp; execute</button>
                    </form>
                    <form method="post" action="/api/ai">
                      <input type="hidden" name="op" value="reject" />
                      <input type="hidden" name="_role" value="hr" />
                      <input type="hidden" name="taskId" value={t.id} />
                      <button type="submit" className="px-3 py-1 text-xs font-medium rounded border border-line text-mute-2 hover:border-red-400 hover:text-red-600">reject</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold tracking-tight text-chalk mb-3">Agent activity (audit trail)</h2>
        <div className="rounded-lg border border-line overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left">
                {['Agent', 'Intent', 'Status', 'Approved by', 'Result'].map((h) => (
                  <th key={h} className="px-5 py-3 font-body text-xs font-semibold text-mute-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data!.tasks.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-6 font-heading italic text-mute-3">No agent tasks yet.</td></tr>
              )}
              {data!.tasks.map((t) => (
                <tr key={t.id} className="border-b border-line last:border-b-0 hover:bg-brand-50 transition-colors">
                  <td className="px-5 py-3 font-semibold">{t.agent}</td>
                  <td className="px-5 py-3">{t.intent}</td>
                  <td className={`px-5 py-3 font-semibold ${
                    t.status === 'executed' ? 'text-brand' : t.status === 'rejected' || t.status === 'failed' ? 'text-red-600' : 'text-amber-600'
                  }`}>{t.status.replace(/_/g, ' ')}</td>
                  <td className="px-5 py-3 text-mute-2">{t.approved_by ?? '—'}</td>
                  <td className="px-5 py-3 text-mute-2">{t.result ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
