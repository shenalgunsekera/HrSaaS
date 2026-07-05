import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';

export const dynamic = 'force-dynamic';

const input =
  'border border-line bg-ink px-4 py-3 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand';

/** Employee Master (L1) — typed core list + intake. */
export default async function EmployeesPage() {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  const employees =
    (await withTenantDb((db) =>
      db<
        { employee_number: string; full_name: string; department: string | null;
          designation: string | null; basic_salary: string; date_joined: string; status: string }[]
      >`select employee_number, full_name, department, designation, basic_salary,
          to_char(date_joined,'YYYY-MM-DD') as date_joined, status
        from employees order by employee_number`,
    )) ?? [];
  const themeVars = (ctx.theme?.colors ?? {}) as React.CSSProperties;

  return (
    <main style={themeVars} className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-12 py-16">
        <p className="font-body text-xs tracking-widest3 text-brand uppercase mb-4">
          Employee Master · {ctx.slug}
        </p>
        <h1 className="font-display text-chalk leading-[0.92] mb-10" style={{ fontSize: 'clamp(40px, 5vw, 72px)' }}>
          EMPLOYEES
        </h1>

        <form method="post" action="/api/employees" className="flex flex-wrap items-end gap-3 border border-line bg-surface p-6 mb-10">
          {[
            ['employeeNumber', 'Emp №', 'EMP-001'],
            ['fullName', 'Full name', 'A. B. Perera'],
            ['dateJoined', 'Date joined', ''],
            ['basicSalary', 'Basic (LKR)', '180000'],
            ['allowances', 'Allowances', 'transport:25000, meal:15000'],
            ['department', 'Department', 'Production'],
            ['epfNumber', 'EPF №', ''],
          ].map(([name, label, ph]) => (
            <label key={name} className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
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
          <button type="submit" className="px-8 py-3 bg-brand-gradient text-white font-display text-base tracking-widest uppercase shadow-brand">
            Add employee
          </button>
        </form>

        <div className="border border-line overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left">
                {['№', 'Name', 'Department', 'Designation', 'Basic', 'Joined', 'Status'].map((h) => (
                  <th key={h} className="px-5 py-3 font-body text-xs uppercase tracking-widest text-mute-2">{h}</th>
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
      </div>
    </main>
  );
}
