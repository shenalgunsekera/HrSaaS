import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';
import { ExportBar } from '../../components/ExportBar';
import { TableControls } from '../../components/TableControls';
import { pageSlice, parsePaging } from '../../lib/paging';


export const dynamic = 'force-dynamic';

const input =
  'rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk focus:outline-none focus:border-brand';

const STATUS_STYLE: Record<string, string> = {
  present: 'text-brand',
  late: 'text-amber-600',
  'half-day': 'text-amber-600',
  absent: 'text-red-600',
  leave: 'text-mute-2',
};

/** Attendance (L1): manual capture + month register. */
export default async function AttendancePage(props: {
  searchParams: Promise<{ month?: string; q?: string; page?: string }>;
}) {
  const sp = await props.searchParams;
  const { month: monthParam } = sp;
  const paging = parsePaging(sp);
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? '') ? monthParam! : new Date().toISOString().slice(0, 7);
  const ctx = await getTenantContext();
  if (!ctx) return null;

  const data = await withTenantDb(async (db) => {
    const employees = await db<{ employee_number: string; full_name: string }[]>`
      select employee_number, full_name from employees where status='active' order by employee_number`;
    const rows = await db<
      { employee_number: string; day: string; status: string; clock_in: string | null; clock_out: string | null }[]
    >`select e.employee_number, to_char(a.day,'YYYY-MM-DD') as day, a.status, a.clock_in, a.clock_out
      from attendance_records a join employees e on e.id = a.employee_id
      where to_char(a.day,'YYYY-MM') = ${month}
        and (${paging.q} = '' or e.employee_number ilike ${paging.like}
             or a.status ilike ${paging.like})
      order by a.day desc, e.employee_number
      limit ${paging.pageSize + 1} offset ${paging.offset}`;
    return { employees, rows };
  });
  const { rows: attRows, hasMore } = pageSlice(data!.rows);
  const themeVars = (ctx.theme?.colors ?? {}) as React.CSSProperties;

  return (
    <main style={themeVars} className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
          Attendance · {ctx.slug} · {month}
        </p>
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-chalk">Attendance</h1>
          <ExportBar entity="attendance" />
        </div>

        <form method="post" action="/api/attendance" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5 mb-10">
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Employee
            <select name="employeeNumber" className={input}>
              {data!.employees.map((e) => (
                <option key={e.employee_number} value={e.employee_number}>
                  {e.employee_number} · {e.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Day
            <input name="day" type="date" required className={input} />
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Status
            <select name="status" className={input}>
              {['present', 'late', 'half-day', 'absent', 'leave'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            In
            <input name="clockIn" type="time" className={input} />
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Out
            <input name="clockOut" type="time" className={input} />
          </label>
          <button type="submit" className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-600 transition-colors">
            Mark
          </button>
        </form>

        <TableControls basePath="/attendance" q={paging.q} page={paging.page} hasMore={hasMore} count={attRows.length} extra={{ month }} placeholder="Search employee №, status…" />
        <div className="rounded-lg border border-line overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left">
                {['Day', 'Employee', 'Status', 'In', 'Out'].map((h) => (
                  <th key={h} className="px-5 py-3 font-body text-xs font-semibold text-mute-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attRows.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 font-heading italic text-mute-3">No records for {month}.</td></tr>
              )}
              {attRows.map((r) => (
                <tr key={`${r.employee_number}-${r.day}`} className="border-b border-line last:border-b-0 hover:bg-brand-50 transition-colors">
                  <td className="px-5 py-3 text-mute-2">{r.day}</td>
                  <td className="px-5 py-3 font-semibold">{r.employee_number}</td>
                  <td className={`px-5 py-3 font-semibold ${STATUS_STYLE[r.status] ?? ''}`}>{r.status}</td>
                  <td className="px-5 py-3">{r.clock_in ?? '—'}</td>
                  <td className="px-5 py-3">{r.clock_out ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
