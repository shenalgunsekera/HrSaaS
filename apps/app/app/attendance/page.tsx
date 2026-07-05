import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';

export const dynamic = 'force-dynamic';

const input =
  'border border-line bg-ink px-4 py-3 font-body text-sm text-chalk focus:outline-none focus:border-brand';

const STATUS_STYLE: Record<string, string> = {
  present: 'text-brand',
  late: 'text-amber-600',
  'half-day': 'text-amber-600',
  absent: 'text-red-600',
  leave: 'text-mute-2',
};

/** Attendance (L1): manual capture + month register. */
export default async function AttendancePage(props: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await props.searchParams;
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
      order by a.day desc, e.employee_number`;
    return { employees, rows };
  });
  const themeVars = (ctx.theme?.colors ?? {}) as React.CSSProperties;

  return (
    <main style={themeVars} className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-12 py-16">
        <p className="font-body text-xs tracking-widest3 text-brand uppercase mb-4">
          Attendance · {ctx.slug} · {month}
        </p>
        <h1 className="font-display text-chalk leading-[0.92] mb-10" style={{ fontSize: 'clamp(40px, 5vw, 72px)' }}>
          ATTENDANCE
        </h1>

        <form method="post" action="/api/attendance" className="flex flex-wrap items-end gap-3 border border-line bg-surface p-6 mb-10">
          <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
            Employee
            <select name="employeeNumber" className={input}>
              {data!.employees.map((e) => (
                <option key={e.employee_number} value={e.employee_number}>
                  {e.employee_number} · {e.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
            Day
            <input name="day" type="date" required className={input} />
          </label>
          <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
            Status
            <select name="status" className={input}>
              {['present', 'late', 'half-day', 'absent', 'leave'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
            In
            <input name="clockIn" type="time" className={input} />
          </label>
          <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
            Out
            <input name="clockOut" type="time" className={input} />
          </label>
          <button type="submit" className="px-8 py-3 bg-brand-gradient text-white font-display text-base tracking-widest uppercase shadow-brand">
            Mark
          </button>
        </form>

        <div className="border border-line overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left">
                {['Day', 'Employee', 'Status', 'In', 'Out'].map((h) => (
                  <th key={h} className="px-5 py-3 font-body text-xs uppercase tracking-widest text-mute-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data!.rows.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 font-heading italic text-mute-3">No records for {month}.</td></tr>
              )}
              {data!.rows.map((r) => (
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
