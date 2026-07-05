import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';
import { ExportBar } from '../../components/ExportBar';

export const dynamic = 'force-dynamic';

const input =
  'rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk focus:outline-none focus:border-brand';
const fmt = (v: string | number) => Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 });

/** Financial Wellness (L1): advances & loans, recovered through payroll. */
export default async function WellnessPage() {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  const data = await withTenantDb(async (db) => {
    const employees = await db<{ employee_number: string; full_name: string }[]>`
      select employee_number, full_name from employees where status='active' order by employee_number`;
    const advances = await db<
      { id: string; employee_number: string; full_name: string; kind: string;
        principal: string; monthly_installment: string; outstanding: string;
        status: string; reason: string | null }[]
    >`select a.id, e.employee_number, e.full_name, a.kind, a.principal,
        a.monthly_installment, a.outstanding, a.status, a.reason
      from advances a join employees e on e.id = a.employee_id
      order by a.requested_at desc limit 100`;
    const [stats] = await db<[{ outstanding: string; active: string; pending: string }]>`
      select
        coalesce(sum(outstanding) filter (where status = 'active'), 0)::text as outstanding,
        (count(*) filter (where status = 'active'))::text as active,
        (count(*) filter (where status = 'pending'))::text as pending
      from advances`;
    return { employees, advances, stats };
  });

  return (
    <main className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
          Financial Wellness · {ctx.slug}
        </p>
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-chalk">Advances &amp; Loans</h1>
          <ExportBar entity="advances" />
        </div>

        <div className="grid grid-cols-3 gap-px bg-line border border-line mb-10">
          {[
            { k: fmt(data!.stats.outstanding), v: 'Total outstanding (LKR)' },
            { k: data!.stats.active, v: 'Active facilities' },
            { k: data!.stats.pending, v: 'Pending approval' },
          ].map((s) => (
            <div key={s.v} className="bg-ink px-6 py-5 hover:bg-brand-50 transition-colors">
              <div className="text-2xl font-bold text-brand">{s.k}</div>
              <div className="font-body text-xs text-mute-2 mt-1">{s.v}</div>
            </div>
          ))}
        </div>

        <form method="post" action="/api/wellness/advances" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5 mb-10">
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Employee
            <select name="employeeNumber" className={input}>
              {data!.employees.map((e) => (
                <option key={e.employee_number} value={e.employee_number}>{e.employee_number} · {e.full_name}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Kind
            <select name="kind" className={input}><option>advance</option><option>loan</option></select>
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Principal (LKR)
            <input name="principal" type="number" required className={input} />
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Monthly installment
            <input name="installment" type="number" required className={input} />
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Reason
            <input name="reason" className={input} />
          </label>
          <button type="submit" className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-600 transition-colors">
            Request
          </button>
          <p className="font-body text-xs text-mute-3 pb-3">
            Responsible lending: advances ≤50% of basic; loan installments ≤25% of basic.
            Recovery runs through payroll, post-tax.
          </p>
        </form>

        <div className="space-y-3">
          {data!.advances.length === 0 && <p className="font-heading italic text-mute-3">No advances or loans yet.</p>}
          {data!.advances.map((a) => (
            <div key={a.id} className="rounded-lg border border-line bg-ink px-5 py-3.5 flex flex-wrap items-center gap-5 hover:bg-brand-50 transition-colors">
              <span className="font-body font-semibold text-sm min-w-44">{a.full_name} <span className="text-mute-3">{a.employee_number}</span></span>
              <span className="font-body text-xs uppercase tracking-wider px-3 py-1 border border-line text-mute-1">{a.kind}</span>
              <span className="font-body text-sm text-mute-2">
                {fmt(a.principal)} · {fmt(a.monthly_installment)}/mo · outstanding <b className="text-chalk">{fmt(a.outstanding)}</b>
              </span>
              {a.reason && <span className="font-heading italic text-sm text-mute-2">“{a.reason}”</span>}
              <span className={`ml-auto font-body text-xs uppercase tracking-wider font-semibold ${
                a.status === 'active' ? 'text-brand' : a.status === 'settled' ? 'text-mute-2' : a.status === 'rejected' ? 'text-red-600' : 'text-amber-600'
              }`}>{a.status}</span>
              {a.status === 'pending' && (
                <span className="flex gap-2">
                  {(['approve', 'reject'] as const).map((act) => (
                    <form key={act} method="post" action={`/api/wellness/advances/${a.id}/decide`}>
                      <input type="hidden" name="action" value={act} />
                      <input type="hidden" name="_role" value="hr" />
                      <button type="submit" className={`px-4 py-1.5 font-body text-xs uppercase tracking-wider border transition-colors ${
                        act === 'approve' ? 'border-brand text-brand hover:bg-brand hover:text-white' : 'border-line text-mute-2 hover:border-red-400 hover:text-red-600'
                      }`}>{act}</button>
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
