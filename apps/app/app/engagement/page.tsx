import { canUseModule } from '@hr/entitlements';
import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';
import { ExportBar } from '../../components/ExportBar';
import { TableControls } from '../../components/TableControls';
import { pageSlice, parsePaging } from '../../lib/paging';


export const dynamic = 'force-dynamic';

const input =
  'rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand';

interface SurveyRow {
  id: string;
  question: string;
  anonymous: boolean;
  closed_at: string | null;
  responses: number;
  promoters: number;
  detractors: number;
}

const enps = (s: SurveyRow) =>
  s.responses === 0 ? null : Math.round(((s.promoters - s.detractors) / s.responses) * 100);

/** Engagement (L2): pulse surveys + eNPS + participation. */
export default async function EngagementPage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const paging = parsePaging(await props.searchParams);
  const ctx = await getTenantContext();
  if (!ctx) return null;
  if (!canUseModule(ctx.entitlements, 'experience-engagement')) {
    return (
      <main className="min-h-svh flex items-center justify-center px-6">
        <p className="font-body text-sm text-mute-2 max-w-md text-center">
          Employee Experience &amp; Engagement is available from level L2. Your company runs {ctx.tier}.
        </p>
      </main>
    );
  }

  const data = await withTenantDb(async (db) => {
    const surveys = await db<SurveyRow[]>`
      select s.id, s.question, s.anonymous, to_char(s.closed_at,'YYYY-MM-DD') as closed_at,
        count(r.id)::int as responses,
        count(r.id) filter (where r.score >= 9)::int as promoters,
        count(r.id) filter (where r.score <= 6)::int as detractors
      from surveys s left join survey_responses r on r.survey_id = s.id
      where (${paging.q} = '' or s.question ilike ${paging.like})
      group by s.id order by s.created_at desc
      limit ${paging.pageSize + 1} offset ${paging.offset}`;
    const [{ headcount }] = await db<[{ headcount: number }]>`
      select count(*)::int as headcount from employees where status = 'active'`;
    return { surveys, headcount };
  });

  const { rows: surveyRows, hasMore } = pageSlice(data!.surveys);
  const latest = surveyRows[0];
  const latestEnps = latest ? enps(latest) : null;

  return (
    <main className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
          Experience &amp; Engagement · {ctx.slug}
        </p>
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-chalk">Engagement</h1>
          <ExportBar entity="surveys" />
        </div>

        <div className="grid grid-cols-3 gap-px bg-line border border-line mb-8">
          {[
            { k: latestEnps === null ? '—' : String(latestEnps), v: 'Latest survey eNPS (−100…100)' },
            {
              k: latest && data!.headcount > 0
                ? `${Math.min(100, Math.round((latest.responses / data!.headcount) * 100))}%`
                : '—',
              v: 'Latest participation (of active headcount)',
            },
            { k: String(surveyRows.length), v: 'Pulse surveys run' },
          ].map((s) => (
            <div key={s.v} className="bg-ink px-6 py-5 hover:bg-brand-50 transition-colors">
              <div className="text-2xl font-bold text-brand">{s.k}</div>
              <div className="font-body text-xs text-mute-2 mt-1">{s.v}</div>
            </div>
          ))}
        </div>

        <form method="post" action="/api/engagement" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5 mb-8">
          <input type="hidden" name="op" value="survey" />
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1 flex-1 min-w-64">
            Pulse question
            <input name="question" required placeholder="How likely are you to recommend working here? (0–10)" className={input} />
          </label>
          <label className="flex items-center gap-2 font-body text-xs font-medium text-mute-1 pb-2.5">
            <input type="checkbox" name="anonymous" defaultChecked /> anonymous
          </label>
          <button type="submit" className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-600 transition-colors">
            Launch survey
          </button>
        </form>

        <TableControls basePath="/engagement" q={paging.q} page={paging.page} hasMore={hasMore} count={surveyRows.length} placeholder="Search questions…" />
        <div className="space-y-4">
          {surveyRows.length === 0 && (
            <p className="font-heading italic text-mute-3">No surveys yet.</p>
          )}
          {surveyRows.map((s) => {
            const score = enps(s);
            return (
              <section key={s.id} className="rounded-lg border border-line bg-ink px-5 py-4">
                <div className="flex flex-wrap items-center gap-4">
                  <span className="text-sm font-semibold text-chalk">{s.question}</span>
                  <span className="text-xs text-mute-2">
                    {s.anonymous ? 'anonymous' : 'named'} · {s.responses} response{s.responses === 1 ? '' : 's'}
                  </span>
                  <span className={`ml-auto text-sm font-bold ${
                    score === null ? 'text-mute-3' : score >= 0 ? 'text-brand' : 'text-red-600'
                  }`}>
                    eNPS {score ?? '—'}
                  </span>
                  {s.closed_at ? (
                    <span className="text-xs text-mute-3">closed {s.closed_at}</span>
                  ) : (
                    <form method="post" action="/api/engagement">
                      <input type="hidden" name="op" value="close" />
                      <input type="hidden" name="surveyId" value={s.id} />
                      <button type="submit" className="px-3 py-1.5 text-xs font-medium rounded border border-line text-mute-2 hover:border-red-400 hover:text-red-600">
                        close
                      </button>
                    </form>
                  )}
                </div>
                {!s.closed_at && (
                  <form method="post" action="/api/engagement" className="flex flex-wrap items-end gap-2 mt-3 pt-3 border-t border-line">
                    <input type="hidden" name="op" value="respond" />
                    <input type="hidden" name="surveyId" value={s.id} />
                    <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
                      Score (0–10)
                      <input name="score" type="number" min={0} max={10} required className={`${input} w-24`} />
                    </label>
                    <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1 flex-1 min-w-48">
                      Comment
                      <input name="comment" className={input} />
                    </label>
                    <button type="submit" className="px-3 py-2 border border-brand text-brand text-xs font-medium rounded-md hover:bg-brand hover:text-white transition-colors">
                      Respond
                    </button>
                  </form>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
