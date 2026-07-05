import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';
import { ExportBar } from '../../components/ExportBar';
import { TableControls } from '../../components/TableControls';
import { pageSlice, parsePaging } from '../../lib/paging';


export const dynamic = 'force-dynamic';

const input =
  'rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk focus:outline-none focus:border-brand';

const LEAVE_TYPES = ['annual', 'casual', 'medical', 'no-pay', 'maternity', 'paternity', 'lieu', 'study', 'special', 'compassionate'];

/** Leave (L1): request → manager/HR decision. Approved no-pay feeds payroll. */
export default async function LeavePage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const paging = parsePaging(await props.searchParams);
  const ctx = await getTenantContext();
  if (!ctx) return null;
  const data = await withTenantDb(async (db) => {
    const employees = await db<{ employee_number: string; full_name: string }[]>`
      select employee_number, full_name from employees where status='active' order by employee_number`;
    const balances = await db<
      { employee_number: string; full_name: string; leave_type: string; entitled: string; used: string }[]
    >`select e.employee_number, e.full_name, p.leave_type, p.annual_days as entitled,
        coalesce(sum(l.days) filter (where l.status = 'approved'
          and to_char(l.start_date,'YYYY') = to_char(now(),'YYYY')), 0) as used
      from employees e
      cross join leave_policies p
      left join leave_requests l on l.employee_id = e.id and l.leave_type = p.leave_type
      where e.status = 'active' and p.annual_days > 0 and p.leave_type in ('annual','casual','medical')
      group by e.employee_number, e.full_name, p.leave_type, p.annual_days
      order by e.employee_number, p.leave_type`;
    const requests = await db<
      { id: string; employee_number: string; full_name: string; leave_type: string;
        start_date: string; end_date: string; days: string; status: string; reason: string | null }[]
    >`select l.id, e.employee_number, e.full_name, l.leave_type,
        to_char(l.start_date,'YYYY-MM-DD') as start_date,
        to_char(l.end_date,'YYYY-MM-DD') as end_date, l.days, l.status, l.reason
      from leave_requests l join employees e on e.id = l.employee_id
      where (${paging.q} = '' or e.full_name ilike ${paging.like}
             or e.employee_number ilike ${paging.like}
             or l.leave_type ilike ${paging.like} or l.status ilike ${paging.like})
      order by l.created_at desc
      limit ${paging.pageSize + 1} offset ${paging.offset}`;
    return { employees, requests, balances };
  });
  const { rows: reqRows, hasMore } = pageSlice(data!.requests);
  const themeVars = (ctx.theme?.colors ?? {}) as React.CSSProperties;

  return (
    <main style={themeVars} className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
          Leave · {ctx.slug}
        </p>
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-chalk">Leave</h1>
          <ExportBar entity="leave" />
        </div>

        <form method="post" action="/api/leave" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5 mb-10">
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
            Type
            <select name="leaveType" className={input}>
              {LEAVE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            From
            <input name="startDate" type="date" required className={input} />
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            To
            <input name="endDate" type="date" required className={input} />
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Reason
            <input name="reason" className={input} />
          </label>
          <button type="submit" className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-600 transition-colors">
            Request leave
          </button>
        </form>

        {data!.balances.length > 0 && (
          <div className="rounded-lg border border-line overflow-x-auto mb-10">
            <table className="w-full font-body text-sm">
              <thead>
                <tr className="border-b border-line bg-surface text-left">
                  {['Employee', 'Type', 'Entitled', 'Used (this year)', 'Remaining'].map((h) => (
                    <th key={h} className="px-5 py-3 font-body text-xs font-semibold text-mute-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data!.balances.map((b) => {
                  const remaining = Number(b.entitled) - Number(b.used);
                  return (
                    <tr key={`${b.employee_number}-${b.leave_type}`} className="border-b border-line last:border-b-0 hover:bg-brand-50 transition-colors">
                      <td className="px-5 py-2.5 font-semibold">{b.full_name} <span className="text-mute-3">{b.employee_number}</span></td>
                      <td className="px-5 py-2.5">{b.leave_type}</td>
                      <td className="px-5 py-2.5">{Number(b.entitled)}</td>
                      <td className="px-5 py-2.5">{Number(b.used)}</td>
                      <td className={`px-5 py-2.5 font-semibold ${remaining <= 0 ? 'text-red-600' : 'text-brand'}`}>{remaining}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <TableControls basePath="/leave" q={paging.q} page={paging.page} hasMore={hasMore} count={reqRows.length} placeholder="Search name, type, status…" />
        <div className="space-y-3">
          {reqRows.length === 0 && (
            <p className="font-heading italic text-mute-3">No leave requests yet.</p>
          )}
          {reqRows.map((r) => (
            <div key={r.id} className="rounded-lg border border-line bg-ink px-5 py-3.5 flex flex-wrap items-center gap-5 hover:bg-brand-50 transition-colors">
              <span className="font-body font-semibold text-sm min-w-44">
                {r.full_name} <span className="text-mute-3">{r.employee_number}</span>
              </span>
              <span className={`font-body text-xs uppercase tracking-wider px-3 py-1 border ${r.leave_type === 'no-pay' ? 'border-red-300 text-red-600' : 'border-line text-mute-1'}`}>
                {r.leave_type}
              </span>
              <span className="font-body text-sm text-mute-2">
                {r.start_date} → {r.end_date} · {Number(r.days)}d
              </span>
              {r.reason && <span className="font-heading italic text-sm text-mute-2">“{r.reason}”</span>}
              <span className={`ml-auto font-body text-xs uppercase tracking-wider font-semibold ${
                r.status === 'approved' ? 'text-brand' : r.status === 'rejected' ? 'text-red-600' : 'text-amber-600'
              }`}>
                {r.status}
              </span>
              {r.status === 'pending' && (
                <span className="flex gap-2">
                  {(['approve', 'reject'] as const).map((a) => (
                    <form key={a} method="post" action={`/api/leave/${r.id}/decide`}>
                      <input type="hidden" name="action" value={a} />
                      <input type="hidden" name="_role" value="hr" />
                      <button
                        type="submit"
                        className={`px-4 py-1.5 font-body text-xs uppercase tracking-wider border transition-colors ${
                          a === 'approve'
                            ? 'border-brand text-brand hover:bg-brand hover:text-white'
                            : 'border-line text-mute-2 hover:border-red-400 hover:text-red-600'
                        }`}
                      >
                        {a}
                      </button>
                    </form>
                  ))}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
