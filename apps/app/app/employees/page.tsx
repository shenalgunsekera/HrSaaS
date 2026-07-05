import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';
import { ExportBar } from '../../components/ExportBar';
import { TableControls } from '../../components/TableControls';
import { pageSlice, parsePaging } from '../../lib/paging';

export const dynamic = 'force-dynamic';

const input =
  'rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand';

/** Employee Master (L1) — typed core list + intake. */
export default async function EmployeesPage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const paging = parsePaging(await props.searchParams);
  const ctx = await getTenantContext();
  if (!ctx) return null;
  const settlements =
    (await withTenantDb((db) =>
      db<
        { full_name: string; employee_number: string; last_day: string; reason: string;
          completed_years: number; gratuity: string }[]
      >`select e.full_name, e.employee_number, to_char(s.last_day,'YYYY-MM-DD') as last_day,
          s.reason, s.completed_years, s.gratuity
        from final_settlements s join employees e on e.id = s.employee_id
        order by s.created_at desc`,
    )) ?? [];
  const { rows: employees, hasMore } = pageSlice(
    (await withTenantDb((db) =>
      db<
        { employee_number: string; full_name: string; department: string | null;
          designation: string | null; basic_salary: string; date_joined: string; status: string }[]
      >`select employee_number, full_name, department, designation, basic_salary,
          to_char(date_joined,'YYYY-MM-DD') as date_joined, status
        from employees
        where (${paging.q} = '' or full_name ilike ${paging.like}
               or employee_number ilike ${paging.like} or department ilike ${paging.like})
        order by employee_number
        limit ${paging.pageSize + 1} offset ${paging.offset}`,
    )) ?? [],
  );
  const themeVars = (ctx.theme?.colors ?? {}) as React.CSSProperties;

  return (
    <main style={themeVars} className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
          Employee Master · {ctx.slug}
        </p>
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-chalk">Employees</h1>
          <ExportBar entity="employees" />
        </div>

        <form method="post" action="/api/employees" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5 mb-10">
          {[
            ['employeeNumber', 'Emp №', 'EMP-001'],
            ['fullName', 'Full name', 'A. B. Perera'],
            ['dateJoined', 'Date joined', ''],
            ['basicSalary', 'Basic (LKR)', '180000'],
            ['allowances', 'Allowances', 'transport:25000, meal:15000'],
            ['department', 'Department', 'Production'],
            ['epfNumber', 'EPF №', ''],
          ].map(([name, label, ph]) => (
            <label key={name} className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              {label}
              <input
                name={name}
                placeholder={ph}
                type={name === 'dateJoined' ? 'date' : name === 'basicSalary' ? 'number' : 'text'}
                required={['employeeNumber', 'fullName', 'dateJoined', 'basicSalary'].includes(name!)}
                className={input}
              />
            </label>
          ))}
          <button type="submit" className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-600 transition-colors">
            Add employee
          </button>
        </form>

        <TableControls basePath="/employees" q={paging.q} page={paging.page} hasMore={hasMore} count={employees.length} placeholder="Search name, number, department…" />
        <div className="rounded-lg border border-line overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left">
                {['№', 'Name', 'Department', 'Designation', 'Basic', 'Joined', 'Status'].map((h) => (
                  <th key={h} className="px-5 py-3 font-body text-xs font-semibold text-mute-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 font-heading italic text-mute-3">No employees yet.</td></tr>
              )}
              {employees.map((e) => (
                <tr key={e.employee_number} className="border-b border-line last:border-b-0 hover:bg-brand-50 transition-colors">
                  <td className="px-5 py-3 text-mute-2">{e.employee_number}</td>
                  <td className="px-5 py-3 font-semibold">{e.full_name}</td>
                  <td className="px-5 py-3">{e.department ?? '—'}</td>
                  <td className="px-5 py-3">{e.designation ?? '—'}</td>
                  <td className="px-5 py-3">{Number(e.basic_salary).toLocaleString()}</td>
                  <td className="px-5 py-3 text-mute-2">{e.date_joined}</td>
                  <td className="px-5 py-3">{e.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* offboarding: gratuity computed from verified statutory params */}
        <form method="post" action="/api/employees/offboard" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5 mt-10">
          <input type="hidden" name="_role" value="hr" />
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Offboard employee
            <select name="employeeNumber" className={input}>
              {employees.filter((e) => e.status === 'active').map((e) => (
                <option key={e.employee_number} value={e.employee_number}>
                  {e.employee_number} · {e.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Last day
            <input name="lastDay" type="date" required className={input} />
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Reason
            <select name="reason" className={input}>
              {['resigned', 'retired', 'terminated', 'deceased'].map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <button type="submit" className="px-4 py-2.5 border border-brand text-brand text-sm font-medium rounded-md hover:bg-brand hover:text-white transition-colors">
            Offboard &amp; settle
          </button>
          <p className="font-body text-xs text-mute-3 pb-3">
            Gratuity: ½ month&apos;s basic per completed year after 5 years (Act 12/1983).
          </p>
        </form>

        {settlements.length > 0 && (
          <div className="rounded-lg border border-line overflow-x-auto mt-6">
            <table className="w-full font-body text-sm">
              <thead>
                <tr className="border-b border-line bg-surface text-left">
                  {['Employee', 'Last day', 'Reason', 'Years', 'Gratuity (LKR)'].map((h) => (
                    <th key={h} className="px-5 py-3 font-body text-xs font-semibold text-mute-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr key={s.employee_number} className="border-b border-line last:border-b-0 hover:bg-brand-50 transition-colors">
                    <td className="px-5 py-3 font-semibold">{s.full_name} <span className="text-mute-3">{s.employee_number}</span></td>
                    <td className="px-5 py-3">{s.last_day}</td>
                    <td className="px-5 py-3">{s.reason}</td>
                    <td className="px-5 py-3">{s.completed_years}</td>
                    <td className="px-5 py-3 font-semibold text-brand">
                      {Number(s.gratuity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
