import { canUseModule } from '@hr/entitlements';
import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';
import { ExportBar } from '../../components/ExportBar';
import { TableControls } from '../../components/TableControls';
import { pageSlice, parsePaging } from '../../lib/paging';


export const dynamic = 'force-dynamic';

const input =
  'rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand';

/** Performance (L2): goals with progress + review cycles with weighted rating. */
export default async function PerformancePage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const paging = parsePaging(await props.searchParams);
  const ctx = await getTenantContext();
  if (!ctx) return null;
  if (!canUseModule(ctx.entitlements, 'performance')) {
    return (
      <main className="min-h-svh flex items-center justify-center px-6">
        <p className="font-body text-sm text-mute-2 max-w-md text-center">
          Performance is available from level L2. Your company runs {ctx.tier}.
        </p>
      </main>
    );
  }

  const data = await withTenantDb(async (db) => {
    const employees = await db<{ employee_number: string; full_name: string }[]>`
      select employee_number, full_name from employees where status='active' order by employee_number`;
    const goals = await db<
      { id: string; employee_number: string; full_name: string; title: string;
        weight: string; progress: number; status: string; target_date: string | null }[]
    >`select g.id, e.employee_number, e.full_name, g.title, g.weight, g.progress, g.status,
        to_char(g.target_date,'YYYY-MM-DD') as target_date
      from goals g join employees e on e.id = g.employee_id
      where (${paging.q} = '' or e.full_name ilike ${paging.like}
             or g.title ilike ${paging.like} or g.status ilike ${paging.like})
      order by e.employee_number, g.created_at
      limit ${paging.pageSize + 1} offset ${paging.offset}`;
    const reviews = await db<
      { employee_number: string; full_name: string; period: string; self_rating: number | null;
        manager_rating: number | null; final_rating: string | null; status: string }[]
    >`select e.employee_number, e.full_name, r.period, r.self_rating, r.manager_rating,
        r.final_rating, r.status
      from performance_reviews r join employees e on e.id = r.employee_id
      order by r.period desc, e.employee_number`;
    return { employees, goals, reviews };
  });

  const { rows: goalRows, hasMore } = pageSlice(data!.goals);
  return (
    <main className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
          Performance · {ctx.slug}
        </p>
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-chalk">Performance</h1>
          <ExportBar entity="goals" />
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <form method="post" action="/api/performance/goals" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5">
            <input type="hidden" name="op" value="create" />
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Employee
              <select name="employeeNumber" className={input}>
                {data!.employees.map((e) => (
                  <option key={e.employee_number} value={e.employee_number}>{e.employee_number} · {e.full_name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Goal
              <input name="title" required placeholder="Reduce line downtime 15%" className={input} />
            </label>
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Weight
              <input name="weight" type="number" step="0.5" defaultValue={1} min={0.5} className={`${input} w-20`} />
            </label>
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Target
              <input name="targetDate" type="date" className={input} />
            </label>
            <button type="submit" className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-600 transition-colors">
              Add goal
            </button>
          </form>

          <form method="post" action="/api/performance/reviews" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5">
            <input type="hidden" name="_role" value="manager" />
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Employee
              <select name="employeeNumber" className={input}>
                {data!.employees.map((e) => (
                  <option key={e.employee_number} value={e.employee_number}>{e.employee_number} · {e.full_name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Period
              <input name="period" required placeholder="2026-H1" pattern="\d{4}(-H[12])?" className={`${input} w-28`} />
            </label>
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Self (1–5)
              <input name="selfRating" type="number" min={1} max={5} className={`${input} w-20`} />
            </label>
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Manager (1–5)
              <input name="managerRating" type="number" min={1} max={5} className={`${input} w-20`} />
            </label>
            <label className="flex items-center gap-2 font-body text-xs font-medium text-mute-1 pb-2.5">
              <input type="checkbox" name="finalize" /> finalize (weighted)
            </label>
            <button type="submit" className="px-4 py-2.5 border border-brand text-brand text-sm font-medium rounded-md hover:bg-brand hover:text-white transition-colors">
              Record review
            </button>
          </form>
        </div>

        <h2 className="text-xl font-bold tracking-tight text-chalk mb-3">Goals</h2>
        <TableControls basePath="/performance" q={paging.q} page={paging.page} hasMore={hasMore} count={goalRows.length} placeholder="Search employee, goal, status…" />
        <div className="rounded-lg border border-line overflow-x-auto mb-8">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left">
                {['Employee', 'Goal', 'Weight', 'Target', 'Progress', ''].map((h, i) => (
                  <th key={i} className="px-5 py-3 font-body text-xs font-semibold text-mute-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {goalRows.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-6 font-heading italic text-mute-3">No goals yet.</td></tr>
              )}
              {goalRows.map((g) => (
                <tr key={g.id} className="border-b border-line last:border-b-0 hover:bg-brand-50 transition-colors">
                  <td className="px-5 py-3 font-semibold">{g.full_name} <span className="text-mute-3">{g.employee_number}</span></td>
                  <td className="px-5 py-3">{g.title}</td>
                  <td className="px-5 py-3">{Number(g.weight)}</td>
                  <td className="px-5 py-3 text-mute-2">{g.target_date ?? '—'}</td>
                  <td className="px-5 py-3 min-w-40">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded bg-line overflow-hidden">
                        <div className="h-full bg-brand" style={{ width: `${g.progress}%` }} />
                      </div>
                      <span className={`text-xs font-semibold ${g.status === 'achieved' ? 'text-brand' : 'text-mute-2'}`}>
                        {g.progress}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <form method="post" action="/api/performance/goals" className="flex gap-1.5">
                      <input type="hidden" name="op" value="progress" />
                      <input type="hidden" name="id" value={g.id} />
                      <input name="progress" type="number" min={0} max={100} defaultValue={g.progress} className="w-16 rounded border border-line bg-ink px-1.5 py-1 text-xs" />
                      <button type="submit" className="px-2.5 py-1 text-xs font-medium rounded border border-line text-mute-2 hover:border-brand hover:text-brand">
                        update
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="text-xl font-bold tracking-tight text-chalk mb-3">Reviews</h2>
        <div className="rounded-lg border border-line overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left">
                {['Employee', 'Period', 'Self', 'Manager', 'Final (weighted)', 'Status'].map((h) => (
                  <th key={h} className="px-5 py-3 font-body text-xs font-semibold text-mute-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data!.reviews.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-6 font-heading italic text-mute-3">No reviews yet.</td></tr>
              )}
              {data!.reviews.map((r) => (
                <tr key={`${r.employee_number}-${r.period}`} className="border-b border-line last:border-b-0 hover:bg-brand-50 transition-colors">
                  <td className="px-5 py-3 font-semibold">{r.full_name} <span className="text-mute-3">{r.employee_number}</span></td>
                  <td className="px-5 py-3">{r.period}</td>
                  <td className="px-5 py-3">{r.self_rating ?? '—'}</td>
                  <td className="px-5 py-3">{r.manager_rating ?? '—'}</td>
                  <td className="px-5 py-3 font-semibold text-brand">{r.final_rating ?? '—'}</td>
                  <td className="px-5 py-3">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
