import { canUseModule } from '@hr/entitlements';
import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';

export const dynamic = 'force-dynamic';

const input =
  'rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand';
const STAGES = ['applied', 'shortlisted', 'interview', 'offered'] as const;
const NEXT: Record<string, string> = {
  applied: 'shortlisted',
  shortlisted: 'interview',
  interview: 'offered',
};

/** Recruitment (L2): vacancies + pipeline board; hiring lands in Employee Master. */
export default async function RecruitmentPage() {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  if (!canUseModule(ctx.entitlements, 'recruitment')) {
    return (
      <main className="min-h-svh flex items-center justify-center px-6">
        <p className="font-body text-sm text-mute-2 max-w-md text-center">
          Recruitment is available from level L2. Your company runs {ctx.tier} — upgrading
          switches it on instantly, no migration.
        </p>
      </main>
    );
  }

  const data = await withTenantDb(async (db) => {
    const vacancies = await db<
      { id: string; title: string; department: string | null; headcount: number; status: string }[]
    >`select id, title, department, headcount, status from vacancies order by created_at desc`;
    const candidates = await db<
      { id: string; vacancy_id: string; full_name: string; email: string; status: string; source: string }[]
    >`select id, vacancy_id, full_name, email, status, source from candidates order by created_at`;
    return { vacancies, candidates };
  });

  return (
    <main className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
          Recruitment · {ctx.slug}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-chalk mb-8">Recruitment</h1>

        <form method="post" action="/api/recruitment/vacancies" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5 mb-8">
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Vacancy title
            <input name="title" required placeholder="Production Supervisor" className={input} />
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Department
            <input name="department" className={input} />
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Headcount
            <input name="headcount" type="number" defaultValue={1} min={1} className={input} />
          </label>
          <button type="submit" className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-600 transition-colors">
            Open vacancy
          </button>
        </form>

        {data!.vacancies.map((v) => {
          const pipeline = data!.candidates.filter((c) => c.vacancy_id === v.id);
          return (
            <section key={v.id} className="rounded-lg border border-line bg-ink mb-8">
              <header className="px-5 py-3.5 border-b border-line flex flex-wrap items-center gap-3">
                <span className="text-base font-semibold text-chalk">{v.title}</span>
                <span className="text-xs text-mute-2">
                  {v.department ?? '—'} · {v.headcount} position{v.headcount > 1 ? 's' : ''} · {v.status}
                </span>
                <form method="post" action="/api/recruitment/candidates" className="ml-auto flex flex-wrap items-end gap-2">
                  <input type="hidden" name="vacancyId" value={v.id} />
                  <input name="fullName" required placeholder="Candidate name" className={input} />
                  <input name="email" type="email" required placeholder="email" className={input} />
                  <button type="submit" className="px-3 py-2 border border-brand text-brand text-xs font-medium rounded-md hover:bg-brand hover:text-white transition-colors">
                    Add candidate
                  </button>
                </form>
              </header>
              <div className="grid md:grid-cols-4 gap-px bg-line">
                {STAGES.map((stage) => (
                  <div key={stage} className="bg-ink p-4 min-h-28">
                    <p className="text-xs font-semibold text-mute-2 mb-3 capitalize">{stage}</p>
                    {pipeline.filter((c) => c.status === stage).map((c) => (
                      <div key={c.id} className="rounded-md border border-line p-3 mb-2 hover:border-brand transition-colors">
                        <div className="text-sm font-semibold text-chalk">{c.full_name}</div>
                        <div className="text-xs text-mute-3 mb-2">{c.email}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {NEXT[stage] && (
                            <form method="post" action={`/api/recruitment/candidates/${c.id}/status`}>
                              <input type="hidden" name="status" value={NEXT[stage]} />
                              <button type="submit" className="px-2.5 py-1 text-[11px] font-medium rounded border border-brand text-brand hover:bg-brand hover:text-white transition-colors">
                                → {NEXT[stage]}
                              </button>
                            </form>
                          )}
                          {stage === 'offered' && (
                            <form method="post" action={`/api/recruitment/candidates/${c.id}/status`} className="flex flex-wrap gap-1.5">
                              <input type="hidden" name="status" value="hired" />
                              <input name="employeeNumber" required placeholder="EMP-№" className="w-20 rounded border border-line bg-ink px-1.5 py-1 text-[11px]" />
                              <input name="basicSalary" required type="number" placeholder="basic" className="w-20 rounded border border-line bg-ink px-1.5 py-1 text-[11px]" />
                              <input name="dateJoined" required type="date" className="rounded border border-line bg-ink px-1.5 py-1 text-[11px]" />
                              <button type="submit" className="px-2.5 py-1 text-[11px] font-semibold rounded bg-brand text-white hover:bg-brand-600 transition-colors">
                                Hire
                              </button>
                            </form>
                          )}
                          <form method="post" action={`/api/recruitment/candidates/${c.id}/status`}>
                            <input type="hidden" name="status" value="rejected" />
                            <button type="submit" className="px-2.5 py-1 text-[11px] font-medium rounded border border-line text-mute-2 hover:border-red-400 hover:text-red-600 transition-colors">
                              reject
                            </button>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              {pipeline.some((c) => c.status === 'hired' || c.status === 'rejected') && (
                <footer className="px-5 py-2.5 border-t border-line text-xs text-mute-2">
                  {pipeline.filter((c) => c.status === 'hired').map((c) => `✓ ${c.full_name} hired`).join(' · ')}
                  {pipeline.some((c) => c.status === 'hired') && pipeline.some((c) => c.status === 'rejected') ? ' · ' : ''}
                  {pipeline.filter((c) => c.status === 'rejected').length > 0 &&
                    `${pipeline.filter((c) => c.status === 'rejected').length} rejected`}
                </footer>
              )}
            </section>
          );
        })}
        {data!.vacancies.length === 0 && (
          <p className="font-heading italic text-mute-3">No vacancies yet — open the first one above.</p>
        )}
      </div>
    </main>
  );
}
