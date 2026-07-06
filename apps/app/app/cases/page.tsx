import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';
import { TableControls } from '../../components/TableControls';
import { pageSlice, parsePaging } from '../../lib/paging';

export const dynamic = 'force-dynamic';

const input =
  'rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand';

/**
 * Disciplinary & Grievance — employee relations. Legally sensitive; the API
 * restricts every mutation to HR / tenant-admin. This page is viewed as HR
 * (role simulation until per-tenant auth); managers/employees get 403 on any
 * action server-side.
 */
export default async function CasesPage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const paging = parsePaging(await props.searchParams);
  const ctx = await getTenantContext();
  if (!ctx) return null;

  const data = await withTenantDb(async (db) => {
    const employees = await db<{ employee_number: string; full_name: string }[]>`
      select employee_number, full_name from employees order by employee_number`;
    const cases = await db<
      { id: string; case_number: string; kind: string; employee: string; employee_number: string;
        summary: string; severity: string; status: string; outcome: string | null; notes: number }[]
    >`select c.id, c.case_number, c.kind, e.full_name as employee, e.employee_number,
        c.summary, c.severity, c.status, c.outcome,
        (select count(*) from case_notes n where n.case_id = c.id)::int as notes
      from cases c join employees e on e.id = c.employee_id
      where (${paging.q} = '' or c.case_number ilike ${paging.like}
             or e.full_name ilike ${paging.like} or c.kind ilike ${paging.like})
      order by case c.status when 'open' then 0 when 'investigating' then 1 else 2 end, c.created_at desc
      limit ${paging.pageSize + 1} offset ${paging.offset}`;
    const [stats] = await db<[{ open: string; disciplinary: string; grievance: string }]>`
      select
        (select count(*) from cases where status <> 'closed')::text as open,
        (select count(*) from cases where kind = 'disciplinary')::text as disciplinary,
        (select count(*) from cases where kind = 'grievance')::text as grievance`;
    return { employees, cases, stats };
  });

  const { rows: caseRows, hasMore } = pageSlice(data!.cases);

  return (
    <main className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
          Employee Relations · {ctx.slug}
        </p>
        <div className="flex flex-wrap items-center gap-4 mb-2">
          <h1 className="text-3xl font-bold tracking-tight text-chalk">Disciplinary &amp; Grievance</h1>
        </div>
        <p className="font-body text-xs text-mute-3 mb-8 flex items-center gap-2">
          <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold">RESTRICTED</span>
          Confidential case records — HR and administrators only. Every action is audited.
        </p>

        <div className="grid grid-cols-3 gap-px bg-line border border-line mb-8">
          {[
            { k: data!.stats.open, v: 'Open cases', warn: Number(data!.stats.open) > 0 },
            { k: data!.stats.disciplinary, v: 'Disciplinary (total)' },
            { k: data!.stats.grievance, v: 'Grievance (total)' },
          ].map((s) => (
            <div key={s.v} className="bg-ink px-6 py-5 hover:bg-brand-50 transition-colors">
              <div className={`text-2xl font-bold ${s.warn ? 'text-amber-600' : 'text-brand'}`}>{s.k}</div>
              <div className="font-body text-xs text-mute-2 mt-1">{s.v}</div>
            </div>
          ))}
        </div>

        <form method="post" action="/api/cases" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5 mb-8">
          <input type="hidden" name="op" value="open" />
          <input type="hidden" name="_role" value="hr" />
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Kind
            <select name="kind" className={input}><option>disciplinary</option><option>grievance</option></select>
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Employee
            <select name="employeeNumber" className={input}>
              {data!.employees.map((e) => <option key={e.employee_number} value={e.employee_number}>{e.employee_number} · {e.full_name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Severity
            <select name="severity" className={input}>{['minor', 'major', 'gross'].map((s) => <option key={s}>{s}</option>)}</select>
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1 flex-1 min-w-64">
            Summary
            <input name="summary" required placeholder="Repeated unauthorised absence" className={input} />
          </label>
          <button type="submit" className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-600 transition-colors">Open case</button>
        </form>

        <TableControls basePath="/cases" q={paging.q} page={paging.page} hasMore={hasMore} count={caseRows.length} placeholder="Search case №, employee, kind…" />
        <div className="space-y-3">
          {caseRows.length === 0 && <p className="font-heading italic text-mute-3">No cases on file.</p>}
          {caseRows.map((c) => (
            <section key={c.id} className="rounded-lg border border-line bg-ink px-5 py-4">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className="font-mono text-xs text-mute-3">{c.case_number}</span>
                <span className={`text-xs font-semibold uppercase ${c.kind === 'disciplinary' ? 'text-red-600' : 'text-brand'}`}>{c.kind}</span>
                <span className="text-sm font-semibold text-chalk">{c.employee}</span>
                <span className={`text-xs font-semibold ${c.severity === 'gross' ? 'text-red-600' : c.severity === 'major' ? 'text-amber-600' : 'text-mute-2'}`}>{c.severity}</span>
                <span className="text-xs text-mute-2">· {c.notes} note{c.notes === 1 ? '' : 's'}</span>
                <span className={`ml-auto text-xs font-semibold ${c.status === 'closed' ? 'text-mute-3' : 'text-amber-600'}`}>{c.status}</span>
              </div>
              <p className="text-sm text-mute-1 mb-2">{c.summary}</p>
              {c.outcome && <p className="text-xs text-brand mb-2">Outcome: {c.outcome}</p>}
              {c.status !== 'closed' && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-line">
                  <form method="post" action="/api/cases" className="flex gap-1.5 flex-1 min-w-64">
                    <input type="hidden" name="op" value="note" />
                    <input type="hidden" name="_role" value="hr" />
                    <input type="hidden" name="caseId" value={c.id} />
                    <input name="note" placeholder="Add investigation note…" className={`${input} flex-1`} />
                    <button type="submit" className="px-3 py-1.5 text-xs rounded border border-line text-mute-2 hover:border-brand hover:text-brand">note</button>
                  </form>
                  <form method="post" action="/api/cases" className="flex gap-1.5">
                    <input type="hidden" name="op" value="close" />
                    <input type="hidden" name="_role" value="hr" />
                    <input type="hidden" name="caseId" value={c.id} />
                    <input name="outcome" placeholder="Outcome / resolution" className={input} />
                    <button type="submit" className="px-3 py-1.5 text-xs rounded border border-brand text-brand hover:bg-brand hover:text-white">close</button>
                  </form>
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
