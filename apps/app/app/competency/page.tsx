import { canUseModule } from '@hr/entitlements';
import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';
import { ExportBar } from '../../components/ExportBar';
import { TableControls } from '../../components/TableControls';
import { pageSlice, parsePaging } from '../../lib/paging';

export const dynamic = 'force-dynamic';

const input =
  'rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand';

/**
 * Competency (L3): library, role requirements, assessments, gap heatmap.
 * A gap is (required level for the employee's designation) − (assessed level);
 * positive = shortfall. Computed at read time.
 */
export default async function CompetencyPage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const paging = parsePaging(await props.searchParams);
  const ctx = await getTenantContext();
  if (!ctx) return null;
  if (!canUseModule(ctx.entitlements, 'competency')) {
    return (
      <main className="min-h-svh flex items-center justify-center px-6">
        <p className="font-body text-sm text-mute-2 max-w-md text-center">
          Competency is available from level L3. Your company runs {ctx.tier}.
        </p>
      </main>
    );
  }

  const data = await withTenantDb(async (db) => {
    const employees = await db<{ employee_number: string; full_name: string; designation: string | null }[]>`
      select employee_number, full_name, designation from employees where status='active' order by employee_number`;
    const competencies = await db<{ id: string; name: string; category: string }[]>`
      select id, name, category from competencies order by category, name`;
    // gap rows: employee × competency where a requirement exists for their designation
    const gaps = await db<
      { employee_number: string; full_name: string; competency: string; category: string;
        required: number; actual: number | null; gap: number }[]
    >`select e.employee_number, e.full_name, c.name as competency, c.category,
        r.required_level as required, a.level as actual,
        (r.required_level - coalesce(a.level, 0)) as gap
      from employees e
      join competency_requirements r on r.designation = e.designation
      join competencies c on c.id = r.competency_id
      left join competency_assessments a on a.competency_id = c.id and a.employee_id = e.id
      where e.status = 'active'
        and (${paging.q} = '' or e.full_name ilike ${paging.like} or c.name ilike ${paging.like})
      order by (r.required_level - coalesce(a.level, 0)) desc, e.employee_number
      limit ${paging.pageSize + 1} offset ${paging.offset}`;
    const [stats] = await db<[{ total_gaps: string; avg_gap: string | null; assessed: string }]>`
      select
        (select count(*) from employees e
          join competency_requirements r on r.designation = e.designation
          left join competency_assessments a on a.competency_id = r.competency_id and a.employee_id = e.id
          where e.status='active' and (r.required_level - coalesce(a.level,0)) > 0)::text as total_gaps,
        (select round(avg(r.required_level - coalesce(a.level,0)),2) from employees e
          join competency_requirements r on r.designation = e.designation
          left join competency_assessments a on a.competency_id = r.competency_id and a.employee_id = e.id
          where e.status='active')::text as avg_gap,
        (select count(*) from competency_assessments)::text as assessed`;
    return { employees, competencies, gaps, stats };
  });

  const { rows: gapRows, hasMore } = pageSlice(data!.gaps);
  const designations = [...new Set(data!.employees.map((e) => e.designation).filter(Boolean))] as string[];

  return (
    <main className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
          Competency · {ctx.slug}
        </p>
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-chalk">Competency</h1>
          <ExportBar entity="competency-gaps" />
        </div>

        <div className="grid grid-cols-3 gap-px bg-line border border-line mb-8">
          {[
            { k: String(data!.competencies.length), v: 'Competencies in library' },
            { k: data!.stats.total_gaps, v: 'Open competency gaps', warn: Number(data!.stats.total_gaps) > 0 },
            { k: data!.stats.avg_gap ?? '—', v: 'Average gap (levels)' },
          ].map((s) => (
            <div key={s.v} className="bg-ink px-6 py-5 hover:bg-brand-50 transition-colors">
              <div className={`text-2xl font-bold ${s.warn ? 'text-red-600' : 'text-brand'}`}>{s.k}</div>
              <div className="font-body text-xs text-mute-2 mt-1">{s.v}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <form method="post" action="/api/competency" className="rounded-lg border border-line bg-surface p-5 flex flex-col gap-3">
            <input type="hidden" name="op" value="competency" />
            <span className="text-xs font-semibold text-mute-1">Add competency</span>
            <input name="name" required placeholder="Root-cause analysis" className={input} />
            <select name="category" className={input}>
              {['core', 'functional', 'leadership', 'technical', 'behavioural'].map((c) => <option key={c}>{c}</option>)}
            </select>
            <button type="submit" className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-600 transition-colors self-start">Add</button>
          </form>

          <form method="post" action="/api/competency" className="rounded-lg border border-line bg-surface p-5 flex flex-col gap-3">
            <input type="hidden" name="op" value="requirement" />
            <span className="text-xs font-semibold text-mute-1">Set role requirement</span>
            <select name="competencyId" className={input}>
              {data!.competencies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input name="designation" required list="designations" placeholder="Designation" className={input} />
            <datalist id="designations">
              {designations.map((d) => <option key={d} value={d} />)}
            </datalist>
            <select name="requiredLevel" className={input}>
              {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>Level {l}</option>)}
            </select>
            <button type="submit" className="px-4 py-2.5 border border-brand text-brand text-sm font-medium rounded-md hover:bg-brand hover:text-white transition-colors self-start">Set</button>
          </form>

          <form method="post" action="/api/competency" className="rounded-lg border border-line bg-surface p-5 flex flex-col gap-3">
            <input type="hidden" name="op" value="assess" />
            <span className="text-xs font-semibold text-mute-1">Assess employee</span>
            <select name="competencyId" className={input}>
              {data!.competencies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select name="employeeNumber" className={input}>
              {data!.employees.map((e) => <option key={e.employee_number} value={e.employee_number}>{e.employee_number} · {e.full_name}</option>)}
            </select>
            <select name="level" className={input}>
              {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>Level {l}</option>)}
            </select>
            <button type="submit" className="px-4 py-2.5 border border-brand text-brand text-sm font-medium rounded-md hover:bg-brand hover:text-white transition-colors self-start">Assess</button>
          </form>
        </div>

        <h2 className="text-xl font-bold tracking-tight text-chalk mb-3">Gap analysis</h2>
        <TableControls basePath="/competency" q={paging.q} page={paging.page} hasMore={hasMore} count={gapRows.length} placeholder="Search employee, competency…" />
        <div className="rounded-lg border border-line overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left">
                {['Employee', 'Competency', 'Category', 'Required', 'Actual', 'Gap'].map((h) => (
                  <th key={h} className="px-5 py-3 font-body text-xs font-semibold text-mute-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gapRows.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 font-heading italic text-mute-3">
                  No requirements mapped yet — add competencies, set role requirements, then assess.
                </td></tr>
              )}
              {gapRows.map((g, i) => (
                <tr key={i} className="border-b border-line last:border-b-0 hover:bg-brand-50 transition-colors">
                  <td className="px-5 py-3 font-semibold">{g.full_name} <span className="text-mute-3">{g.employee_number}</span></td>
                  <td className="px-5 py-3">{g.competency}</td>
                  <td className="px-5 py-3 text-mute-2">{g.category}</td>
                  <td className="px-5 py-3">{g.required}</td>
                  <td className="px-5 py-3">{g.actual ?? <span className="text-mute-3">not assessed</span>}</td>
                  <td className={`px-5 py-3 font-bold ${g.gap > 0 ? 'text-red-600' : 'text-brand'}`}>
                    {g.gap > 0 ? `−${g.gap}` : 'met'}
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
