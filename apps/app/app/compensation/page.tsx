import { canUseModule } from '@hr/entitlements';
import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';
import { ExportBar } from '../../components/ExportBar';

export const dynamic = 'force-dynamic';

const input =
  'rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand';
const fmt = (v: string | number) => Number(v).toLocaleString();

/** Compensation & Total Rewards (L2): bands, compa-ratio, out-of-band flags. */
export default async function CompensationPage() {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  if (!canUseModule(ctx.entitlements, 'compensation')) {
    return (
      <main className="min-h-svh flex items-center justify-center px-6">
        <p className="font-body text-sm text-mute-2 max-w-md text-center">
          Compensation &amp; Total Rewards is available from level L2. Your company runs {ctx.tier}.
        </p>
      </main>
    );
  }

  const data = await withTenantDb(async (db) => {
    const bands = await db<{ grade: string; band_min: string; band_mid: string; band_max: string }[]>`
      select grade, band_min, band_mid, band_max from salary_bands order by band_mid`;
    const rows = await db<
      { employee_number: string; full_name: string; basic_salary: string;
        salary_grade: string | null; band_min: string | null; band_mid: string | null;
        band_max: string | null }[]
    >`select e.employee_number, e.full_name, e.basic_salary, e.salary_grade,
        b.band_min, b.band_mid, b.band_max
      from employees e left join salary_bands b on b.grade = e.salary_grade
      where e.status = 'active' order by e.employee_number`;
    return { bands, rows };
  });

  const withRatio = data!.rows.map((r) => {
    const compa = r.band_mid ? Number(r.basic_salary) / Number(r.band_mid) : null;
    const outOfBand =
      r.band_min !== null &&
      (Number(r.basic_salary) < Number(r.band_min) || Number(r.basic_salary) > Number(r.band_max));
    return { ...r, compa, outOfBand };
  });
  const rated = withRatio.filter((r) => r.compa !== null);
  const avgCompa = rated.length
    ? (rated.reduce((a, r) => a + (r.compa ?? 0), 0) / rated.length).toFixed(2)
    : '—';

  return (
    <main className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
          Compensation &amp; Total Rewards · {ctx.slug}
        </p>
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-chalk">Compensation</h1>
          <ExportBar entity="bands" />
        </div>

        <div className="grid grid-cols-3 gap-px bg-line border border-line mb-8">
          {[
            { k: avgCompa, v: 'Average compa-ratio' },
            { k: String(data!.bands.length), v: 'Salary bands' },
            { k: String(withRatio.filter((r) => r.outOfBand).length), v: 'Out-of-band salaries', warn: withRatio.some((r) => r.outOfBand) },
          ].map((s) => (
            <div key={s.v} className="bg-ink px-6 py-5 hover:bg-brand-50 transition-colors">
              <div className={`text-2xl font-bold ${s.warn ? 'text-red-600' : 'text-brand'}`}>{s.k}</div>
              <div className="font-body text-xs text-mute-2 mt-1">{s.v}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <form method="post" action="/api/compensation" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5">
            <input type="hidden" name="op" value="band" />
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Grade
              <input name="grade" required placeholder="G5" className={`${input} w-20`} />
            </label>
            {(['min', 'mid', 'max'] as const).map((f) => (
              <label key={f} className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
                {f.toUpperCase()}
                <input name={f} type="number" required className={`${input} w-28`} />
              </label>
            ))}
            <button type="submit" className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-600 transition-colors">
              Save band
            </button>
          </form>

          <form method="post" action="/api/compensation" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5">
            <input type="hidden" name="op" value="assign" />
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Employee
              <select name="employeeNumber" className={input}>
                {data!.rows.map((e) => (
                  <option key={e.employee_number} value={e.employee_number}>{e.employee_number} · {e.full_name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Grade
              <select name="grade" className={input}>
                {data!.bands.map((b) => <option key={b.grade}>{b.grade}</option>)}
              </select>
            </label>
            <button type="submit" className="px-4 py-2.5 border border-brand text-brand text-sm font-medium rounded-md hover:bg-brand hover:text-white transition-colors">
              Assign grade
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-line overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left">
                {['Employee', 'Basic', 'Grade', 'Band (min–mid–max)', 'Compa-ratio', 'Position'].map((h) => (
                  <th key={h} className="px-5 py-3 font-body text-xs font-semibold text-mute-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {withRatio.map((r) => (
                <tr key={r.employee_number} className="border-b border-line last:border-b-0 hover:bg-brand-50 transition-colors">
                  <td className="px-5 py-3 font-semibold">{r.full_name} <span className="text-mute-3">{r.employee_number}</span></td>
                  <td className="px-5 py-3">{fmt(r.basic_salary)}</td>
                  <td className="px-5 py-3">{r.salary_grade ?? '—'}</td>
                  <td className="px-5 py-3 text-mute-2">
                    {r.band_min ? `${fmt(r.band_min)} – ${fmt(r.band_mid!)} – ${fmt(r.band_max!)}` : '—'}
                  </td>
                  <td className={`px-5 py-3 font-semibold ${
                    r.compa === null ? 'text-mute-3' : r.compa < 0.8 || r.compa > 1.2 ? 'text-amber-600' : 'text-brand'
                  }`}>
                    {r.compa?.toFixed(2) ?? '—'}
                  </td>
                  <td className={`px-5 py-3 ${r.outOfBand ? 'text-red-600 font-semibold' : 'text-mute-2'}`}>
                    {r.compa === null ? 'unbanded' : r.outOfBand ? 'OUT OF BAND' : 'in band'}
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
