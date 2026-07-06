import { canUseModule } from '@hr/entitlements';
import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';
import { ExportBar } from '../../components/ExportBar';
import { TableControls } from '../../components/TableControls';
import { pageSlice, parsePaging } from '../../lib/paging';

export const dynamic = 'force-dynamic';

const input =
  'rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand';
const fmt = (v: string | number | null) => (v == null ? '—' : Number(v).toLocaleString());

/** Workforce Planning & Org Design (L3): headcount plan vs actual + positions. */
export default async function WorkforcePage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const paging = parsePaging(await props.searchParams);
  const ctx = await getTenantContext();
  if (!ctx) return null;
  if (!canUseModule(ctx.entitlements, 'workforce-planning')) {
    return (
      <main className="min-h-svh flex items-center justify-center px-6">
        <p className="font-body text-sm text-mute-2 max-w-md text-center">
          Workforce Planning &amp; Org Design is available from level L3. Your company runs {ctx.tier}.
        </p>
      </main>
    );
  }

  const data = await withTenantDb(async (db) => {
    const departments = await db<{ department: string }[]>`
      select distinct department from employees where department is not null and status='active' order by department`;
    const plans = await db<
      { department: string; period: string; approved: number; actual: number; budget: string | null }[]
    >`select p.department, p.period, p.approved_headcount as approved,
        (select count(*) from employees e where e.department = p.department and e.status='active')::int as actual,
        p.budget_cost as budget
      from headcount_plans p order by p.period desc, p.department`;
    const positions = await db<
      { id: string; title: string; department: string; status: string; holder: string | null }[]
    >`select po.id, po.title, po.department, po.status, e.full_name as holder
      from positions po left join employees e on e.id = po.holder_id
      where (${paging.q} = '' or po.title ilike ${paging.like} or po.department ilike ${paging.like})
      order by case po.status when 'open' then 0 when 'frozen' then 1 else 2 end, po.title
      limit ${paging.pageSize + 1} offset ${paging.offset}`;
    const employees = await db<{ employee_number: string; full_name: string }[]>`
      select employee_number, full_name from employees where status='active' order by employee_number`;
    return { departments, plans, positions, employees };
  });

  const { rows: posRows, hasMore } = pageSlice(data!.positions);
  const totalApproved = data!.plans.reduce((a, p) => a + p.approved, 0);
  const totalActual = data!.plans.reduce((a, p) => a + p.actual, 0);

  return (
    <main className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
          Workforce Planning &amp; Org Design · {ctx.slug}
        </p>
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-chalk">Workforce Planning</h1>
          <ExportBar entity="positions" />
        </div>

        <div className="grid grid-cols-3 gap-px bg-line border border-line mb-8">
          {[
            { k: String(totalApproved), v: 'Approved headcount' },
            { k: String(totalActual), v: 'Actual (active)' },
            { k: totalApproved ? `${totalApproved - totalActual}` : '—', v: 'Vacancy vs plan', warn: totalActual > totalApproved },
          ].map((s) => (
            <div key={s.v} className="bg-ink px-6 py-5 hover:bg-brand-50 transition-colors">
              <div className={`text-2xl font-bold ${s.warn ? 'text-red-600' : 'text-brand'}`}>{s.k}</div>
              <div className="font-body text-xs text-mute-2 mt-1">{s.v}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <form method="post" action="/api/workforce" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5">
            <input type="hidden" name="op" value="plan" />
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Department
              <input name="department" required list="depts" placeholder="Production" className={input} />
              <datalist id="depts">{data!.departments.map((d) => <option key={d.department} value={d.department} />)}</datalist>
            </label>
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Period
              <input name="period" type="month" required className={input} />
            </label>
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Approved HC
              <input name="approvedHeadcount" type="number" min={0} required className={`${input} w-24`} />
            </label>
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Budget cost
              <input name="budgetCost" type="number" className={`${input} w-32`} />
            </label>
            <button type="submit" className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-600 transition-colors">Set plan</button>
          </form>

          <form method="post" action="/api/workforce" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5">
            <input type="hidden" name="op" value="position" />
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              New position
              <input name="title" required placeholder="Line Engineer" className={input} />
            </label>
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Department
              <input name="department" required list="depts" className={input} />
            </label>
            <button type="submit" className="px-4 py-2.5 border border-brand text-brand text-sm font-medium rounded-md hover:bg-brand hover:text-white transition-colors">Add position</button>
          </form>
        </div>

        <h2 className="text-xl font-bold tracking-tight text-chalk mb-3">Headcount plan vs actual</h2>
        <div className="rounded-lg border border-line overflow-x-auto mb-8">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left">
                {['Department', 'Period', 'Approved', 'Actual', 'Variance', 'Budget'].map((h) => (
                  <th key={h} className="px-5 py-3 font-body text-xs font-semibold text-mute-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data!.plans.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-6 font-heading italic text-mute-3">No plans set yet.</td></tr>
              )}
              {data!.plans.map((p) => {
                const variance = p.approved - p.actual;
                return (
                  <tr key={`${p.department}-${p.period}`} className="border-b border-line last:border-b-0 hover:bg-brand-50 transition-colors">
                    <td className="px-5 py-3 font-semibold">{p.department}</td>
                    <td className="px-5 py-3 text-mute-2">{p.period}</td>
                    <td className="px-5 py-3">{p.approved}</td>
                    <td className="px-5 py-3">{p.actual}</td>
                    <td className={`px-5 py-3 font-semibold ${variance < 0 ? 'text-red-600' : 'text-brand'}`}>
                      {variance < 0 ? `over by ${-variance}` : variance === 0 ? 'on plan' : `${variance} open`}
                    </td>
                    <td className="px-5 py-3 text-mute-2">{fmt(p.budget)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h2 className="text-xl font-bold tracking-tight text-chalk mb-3">Positions</h2>
        <TableControls basePath="/workforce" q={paging.q} page={paging.page} hasMore={hasMore} count={posRows.length} placeholder="Search position, department…" />
        <div className="rounded-lg border border-line overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left">
                {['Position', 'Department', 'Status', 'Holder', ''].map((h, i) => (
                  <th key={i} className="px-5 py-3 font-body text-xs font-semibold text-mute-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posRows.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-6 font-heading italic text-mute-3">No positions yet.</td></tr>
              )}
              {posRows.map((po) => (
                <tr key={po.id} className="border-b border-line last:border-b-0 hover:bg-brand-50 transition-colors">
                  <td className="px-5 py-3 font-semibold">{po.title}</td>
                  <td className="px-5 py-3">{po.department}</td>
                  <td className={`px-5 py-3 font-semibold ${po.status === 'open' ? 'text-amber-600' : po.status === 'frozen' ? 'text-red-600' : 'text-brand'}`}>{po.status}</td>
                  <td className="px-5 py-3">{po.holder ?? '—'}</td>
                  <td className="px-5 py-3">
                    {po.status !== 'filled' && (
                      <div className="flex flex-wrap gap-1.5">
                        {po.status === 'open' && (
                          <form method="post" action="/api/workforce" className="flex gap-1">
                            <input type="hidden" name="op" value="fill" />
                            <input type="hidden" name="positionId" value={po.id} />
                            <select name="employeeNumber" className="rounded border border-line bg-ink px-1.5 py-1 text-xs">
                              {data!.employees.map((e) => <option key={e.employee_number} value={e.employee_number}>{e.full_name}</option>)}
                            </select>
                            <button type="submit" className="px-2 py-1 text-xs rounded border border-brand text-brand hover:bg-brand hover:text-white">fill</button>
                          </form>
                        )}
                        {po.status === 'open' && (
                          <form method="post" action="/api/workforce">
                            <input type="hidden" name="op" value="freeze" />
                            <input type="hidden" name="positionId" value={po.id} />
                            <button type="submit" className="px-2 py-1 text-xs rounded border border-line text-mute-2 hover:border-red-400 hover:text-red-600">freeze</button>
                          </form>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
