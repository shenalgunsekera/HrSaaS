import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';
import { ExportBar } from '../../components/ExportBar';

export const dynamic = 'force-dynamic';

interface SlipRow {
  id: string;
  full_name: string;
  employee_number: string;
  gross: string;
  no_pay_days: string;
  no_pay_deduction: string;
  epf_employee: string;
  epf_employer: string;
  etf_employer: string;
  apit: string;
  net: string;
}

const fmt = (v: string | number) => Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 });

/** Payroll (L1): run a period; view the latest run's payslips + dashboard strip. */
export default async function PayrollPage() {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  const data = await withTenantDb(async (db) => {
    const [run] = await db<
      { id: string; period: string; status: string; totals: { employees?: number; gross?: number; net?: number; statutoryLiability?: number } }[]
    >`select id, period, status, totals from payroll_runs order by period desc limit 1`;
    if (!run) return { run: null, slips: [] as SlipRow[] };
    const slips = await db<SlipRow[]>`
      select p.id, e.full_name, e.employee_number, p.gross, p.no_pay_days, p.no_pay_deduction,
             p.epf_employee, p.epf_employer, p.etf_employer, p.apit, p.net
      from payslips p join employees e on e.id = p.employee_id
      where p.run_id = ${run.id} order by e.employee_number`;
    return { run, slips };
  });
  const themeVars = (ctx.theme?.colors ?? {}) as React.CSSProperties;
  const run = data?.run;

  return (
    <main style={themeVars} className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
          Payroll · {ctx.slug} · statutory rates from verified tenant reference data
        </p>
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-chalk">Payroll</h1>
          <ExportBar entity="payslips" />
        </div>

        <form method="post" action="/api/payroll/run" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5 mb-10">
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Period
            <input name="period" type="month" required className="rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk focus:outline-none focus:border-brand" />
          </label>
          <button type="submit" className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-600 transition-colors">
            Run payroll
          </button>
          <p className="font-body text-xs text-mute-3 pb-3">
            Draft runs can be re-run; approval locks them. No-pay derives from attendance + approved leave.
          </p>
        </form>

        {run && (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              {run.status === 'draft' && (
                <form method="post" action={`/api/payroll/${run.id}/approve`}>
                  <input type="hidden" name="_role" value="payroll-admin" />
                  <button type="submit" className="px-6 py-2.5 border border-brand text-brand text-sm font-medium rounded-md hover:bg-brand hover:text-white transition-colors">
                    Approve &amp; lock {run.period}
                  </button>
                </form>
              )}
              <a href={`/api/payroll/${run.id}/bank-file`} className="px-4 py-2 border border-line text-mute-1 text-sm font-medium rounded-md hover:border-brand hover:text-brand transition-colors">
                Bank transfer file ↓
              </a>
              <a href={`/api/payroll/${run.id}/statutory-file`} className="px-4 py-2 border border-line text-mute-1 text-sm font-medium rounded-md hover:border-brand hover:text-brand transition-colors">
                EPF/ETF/APIT file ↓
              </a>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line mb-10">
              {[
                { k: run.period, v: `Latest run · ${run.status}` },
                { k: fmt(run.totals.gross ?? 0), v: 'Total gross (LKR)' },
                { k: fmt(run.totals.net ?? 0), v: 'Total net payable' },
                { k: fmt(run.totals.statutoryLiability ?? 0), v: 'Statutory liability (EPF+ETF+APIT)' },
              ].map((s) => (
                <div key={s.v} className="bg-ink px-6 py-5 hover:bg-brand-50 transition-colors">
                  <div className="text-2xl font-bold text-brand">{s.k}</div>
                  <div className="font-body text-xs text-mute-2 mt-1">{s.v}</div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-line overflow-x-auto">
              <table className="w-full font-body text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface text-left">
                    {['Employee', 'Gross', 'No-pay d', 'No-pay ded.', 'EPF 8%', 'EPF 12%', 'ETF 3%', 'APIT', 'Net'].map((h) => (
                      <th key={h} className="px-4 py-3 font-body text-xs font-semibold text-mute-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data!.slips.map((s) => (
                    <tr key={s.employee_number} className="border-b border-line last:border-b-0 hover:bg-brand-50 transition-colors">
                      <td className="px-4 py-3 font-semibold">
                        <a href={`/payslips/${s.id}`} className="hover:text-brand underline decoration-line underline-offset-4">
                          {s.full_name}
                        </a>{' '}
                        <span className="text-mute-3">{s.employee_number}</span>
                      </td>
                      <td className="px-4 py-3">{fmt(s.gross)}</td>
                      <td className="px-4 py-3">{Number(s.no_pay_days)}</td>
                      <td className="px-4 py-3">{fmt(s.no_pay_deduction)}</td>
                      <td className="px-4 py-3">{fmt(s.epf_employee)}</td>
                      <td className="px-4 py-3">{fmt(s.epf_employer)}</td>
                      <td className="px-4 py-3">{fmt(s.etf_employer)}</td>
                      <td className="px-4 py-3">{fmt(s.apit)}</td>
                      <td className="px-4 py-3 font-semibold text-brand">{fmt(s.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
