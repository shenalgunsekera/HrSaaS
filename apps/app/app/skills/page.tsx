import { canUseModule } from '@hr/entitlements';
import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';
import { ExportBar } from '../../components/ExportBar';
import { TableControls } from '../../components/TableControls';
import { pageSlice, parsePaging } from '../../lib/paging';

export const dynamic = 'force-dynamic';

const input =
  'rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand';

/** Skills Intelligence & Talent Marketplace (L3): verified skills + internal gigs. */
export default async function SkillsPage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const paging = parsePaging(await props.searchParams);
  const ctx = await getTenantContext();
  if (!ctx) return null;
  if (!canUseModule(ctx.entitlements, 'skills-intelligence')) {
    return (
      <main className="min-h-svh flex items-center justify-center px-6">
        <p className="font-body text-sm text-mute-2 max-w-md text-center">
          Skills Intelligence &amp; Talent Marketplace is available from level L3. Your company runs {ctx.tier}.
        </p>
      </main>
    );
  }

  const data = await withTenantDb(async (db) => {
    const employees = await db<{ employee_number: string; full_name: string }[]>`
      select employee_number, full_name from employees where status='active' order by employee_number`;
    const skills = await db<{ id: string; name: string }[]>`select id, name from skills order by name`;
    const declared = await db<
      { employee_number: string; full_name: string; skill: string; proficiency: number; verified: boolean }[]
    >`select e.employee_number, e.full_name, s.name as skill, es.proficiency, es.verified
      from employee_skills es join skills s on s.id = es.skill_id
      join employees e on e.id = es.employee_id
      where (${paging.q} = '' or e.full_name ilike ${paging.like} or s.name ilike ${paging.like})
      order by es.verified desc, s.name
      limit ${paging.pageSize + 1} offset ${paging.offset}`;
    const gigs = await db<
      { id: string; title: string; department: string | null; skill: string | null;
        status: string; assignee: string | null; matches: number }[]
    >`select g.id, g.title, g.department, s.name as skill, g.status,
        ae.full_name as assignee,
        (select count(*) from employee_skills es join employees e2 on e2.id = es.employee_id
         where es.skill_id = g.skill_id and e2.status = 'active')::int as matches
      from gigs g
      left join skills s on s.id = g.skill_id
      left join employees ae on ae.id = g.assignee_id
      order by case g.status when 'open' then 0 when 'filled' then 1 else 2 end, g.created_at desc`;
    const [stats] = await db<[{ verified: string; open_gigs: string; coverage: string }]>`
      select
        (select count(*) from employee_skills where verified)::text as verified,
        (select count(*) from gigs where status = 'open')::text as open_gigs,
        (select count(distinct skill_id) from employee_skills)::text as coverage`;
    return { employees, skills, declared, gigs, stats };
  });

  const { rows: declaredRows, hasMore } = pageSlice(data!.declared);

  return (
    <main className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
          Skills Intelligence &amp; Talent Marketplace · {ctx.slug}
        </p>
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-chalk">Skills</h1>
          <ExportBar entity="employee-skills" />
        </div>

        <div className="grid grid-cols-3 gap-px bg-line border border-line mb-8">
          {[
            { k: data!.stats.verified, v: 'Verified skills' },
            { k: data!.stats.coverage, v: 'Distinct skills covered' },
            { k: data!.stats.open_gigs, v: 'Open internal gigs' },
          ].map((s) => (
            <div key={s.v} className="bg-ink px-6 py-5 hover:bg-brand-50 transition-colors">
              <div className="text-2xl font-bold text-brand">{s.k}</div>
              <div className="font-body text-xs text-mute-2 mt-1">{s.v}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <form method="post" action="/api/skills" className="rounded-lg border border-line bg-surface p-5 flex flex-col gap-3">
            <input type="hidden" name="op" value="skill" />
            <span className="text-xs font-semibold text-mute-1">Add skill to taxonomy</span>
            <input name="name" required placeholder="PLC programming" className={input} />
            <button type="submit" className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-600 transition-colors self-start">Add</button>
          </form>

          <form method="post" action="/api/skills" className="rounded-lg border border-line bg-surface p-5 flex flex-col gap-3">
            <input type="hidden" name="op" value="declare" />
            <span className="text-xs font-semibold text-mute-1">Declare / verify skill</span>
            <select name="skillId" className={input}>
              {data!.skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select name="employeeNumber" className={input}>
              {data!.employees.map((e) => <option key={e.employee_number} value={e.employee_number}>{e.employee_number} · {e.full_name}</option>)}
            </select>
            <div className="flex items-center gap-3">
              <select name="proficiency" className={`${input} flex-1`}>
                {[1, 2, 3, 4, 5].map((l) => <option key={l} value={l}>Level {l}</option>)}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-mute-1"><input type="checkbox" name="verified" /> verified</label>
            </div>
            <button type="submit" className="px-4 py-2.5 border border-brand text-brand text-sm font-medium rounded-md hover:bg-brand hover:text-white transition-colors self-start">Save</button>
          </form>

          <form method="post" action="/api/skills" className="rounded-lg border border-line bg-surface p-5 flex flex-col gap-3">
            <input type="hidden" name="op" value="gig" />
            <span className="text-xs font-semibold text-mute-1">Post internal gig</span>
            <input name="title" required placeholder="Automate line-3 changeover" className={input} />
            <input name="department" placeholder="Department" className={input} />
            <select name="skillId" className={input}>
              <option value="">Any skill</option>
              {data!.skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button type="submit" className="px-4 py-2.5 border border-brand text-brand text-sm font-medium rounded-md hover:bg-brand hover:text-white transition-colors self-start">Post</button>
          </form>
        </div>

        <h2 className="text-xl font-bold tracking-tight text-chalk mb-3">Internal talent marketplace</h2>
        <div className="space-y-3 mb-8">
          {data!.gigs.length === 0 && <p className="font-heading italic text-mute-3">No gigs posted yet.</p>}
          {data!.gigs.map((g) => (
            <div key={g.id} className="rounded-lg border border-line bg-ink px-5 py-3.5 flex flex-wrap items-center gap-4 hover:bg-brand-50 transition-colors">
              <span className="text-sm font-semibold text-chalk">{g.title}</span>
              <span className="text-xs text-mute-2">{g.department ?? '—'}{g.skill ? ` · needs ${g.skill}` : ''}</span>
              {g.status === 'open' && g.skill && (
                <span className="text-xs text-brand">{g.matches} matching employee{g.matches === 1 ? '' : 's'}</span>
              )}
              <span className={`ml-auto text-xs font-semibold ${g.status === 'open' ? 'text-amber-600' : g.status === 'filled' ? 'text-brand' : 'text-mute-3'}`}>
                {g.status}{g.assignee ? ` · ${g.assignee}` : ''}
              </span>
              {g.status === 'open' && (
                <form method="post" action="/api/skills" className="flex gap-1.5">
                  <input type="hidden" name="op" value="assign" />
                  <input type="hidden" name="gigId" value={g.id} />
                  <select name="employeeNumber" className="rounded border border-line bg-ink px-2 py-1 text-xs">
                    {data!.employees.map((e) => <option key={e.employee_number} value={e.employee_number}>{e.full_name}</option>)}
                  </select>
                  <button type="submit" className="px-2.5 py-1 text-xs font-medium rounded border border-brand text-brand hover:bg-brand hover:text-white">assign</button>
                </form>
              )}
            </div>
          ))}
        </div>

        <h2 className="text-xl font-bold tracking-tight text-chalk mb-3">Verified skills inventory</h2>
        <TableControls basePath="/skills" q={paging.q} page={paging.page} hasMore={hasMore} count={declaredRows.length} placeholder="Search employee, skill…" />
        <div className="rounded-lg border border-line overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left">
                {['Employee', 'Skill', 'Proficiency', 'Verified'].map((h) => (
                  <th key={h} className="px-5 py-3 font-body text-xs font-semibold text-mute-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {declaredRows.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-8 font-heading italic text-mute-3">No skills declared yet.</td></tr>
              )}
              {declaredRows.map((d, i) => (
                <tr key={i} className="border-b border-line last:border-b-0 hover:bg-brand-50 transition-colors">
                  <td className="px-5 py-3 font-semibold">{d.full_name} <span className="text-mute-3">{d.employee_number}</span></td>
                  <td className="px-5 py-3">{d.skill}</td>
                  <td className="px-5 py-3">Level {d.proficiency}</td>
                  <td className={`px-5 py-3 font-semibold ${d.verified ? 'text-brand' : 'text-mute-3'}`}>
                    {d.verified ? '✓ verified' : 'self-declared'}
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
