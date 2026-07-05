import { canUseModule } from '@hr/entitlements';
import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';

export const dynamic = 'force-dynamic';

const input =
  'rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand';
const READINESS = ['ready-now', '1-year', '2-3-years', 'develop'];
const READY_STYLE: Record<string, string> = {
  'ready-now': 'text-brand',
  '1-year': 'text-amber-600',
  '2-3-years': 'text-amber-600',
  develop: 'text-mute-2',
};

/** Succession (L3): critical roles, successor bench, readiness, bench strength. */
export default async function SuccessionPage() {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  if (!canUseModule(ctx.entitlements, 'succession')) {
    return (
      <main className="min-h-svh flex items-center justify-center px-6">
        <p className="font-body text-sm text-mute-2 max-w-md text-center">
          Succession is available from level L3. Your company runs {ctx.tier}.
        </p>
      </main>
    );
  }

  const data = await withTenantDb(async (db) => {
    const employees = await db<{ employee_number: string; full_name: string }[]>`
      select employee_number, full_name from employees where status='active' order by employee_number`;
    const roles = await db<
      { id: string; title: string; business_impact: string; incumbent: string | null }[]
    >`select r.id, r.title, r.business_impact, e.full_name as incumbent
      from critical_roles r left join employees e on e.id = r.incumbent_id
      order by case r.business_impact when 'critical' then 0 when 'high' then 1 else 2 end, r.title`;
    const successors = await db<
      { id: string; role_id: string; full_name: string; employee_number: string;
        rank: string; readiness: string }[]
    >`select s.id, s.role_id, e.full_name, e.employee_number, s.rank, s.readiness
      from successors s join employees e on e.id = s.employee_id
      order by case s.rank when 'primary' then 0 when 'secondary' then 1 else 2 end`;
    return { employees, roles, successors };
  });

  const covered = data!.roles.filter((r) => data!.successors.some((s) => s.role_id === r.id));
  const benchStrength = data!.roles.length
    ? Math.round((covered.length / data!.roles.length) * 100)
    : null;
  const readyNow = data!.successors.filter((s) => s.readiness === 'ready-now').length;

  return (
    <main className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
          Succession · {ctx.slug}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-chalk mb-8">Succession</h1>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line mb-8">
          {[
            { k: String(data!.roles.length), v: 'Critical roles' },
            { k: String(data!.roles.length - covered.length), v: 'Roles without successors', warn: data!.roles.length - covered.length > 0 },
            { k: String(readyNow), v: 'Ready-now successors' },
            { k: benchStrength === null ? '—' : `${benchStrength}%`, v: 'Bench strength (roles covered)' },
          ].map((s) => (
            <div key={s.v} className="bg-ink px-6 py-5 hover:bg-brand-50 transition-colors">
              <div className={`text-2xl font-bold ${s.warn ? 'text-red-600' : 'text-brand'}`}>{s.k}</div>
              <div className="font-body text-xs text-mute-2 mt-1">{s.v}</div>
            </div>
          ))}
        </div>

        <form method="post" action="/api/succession" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5 mb-8">
          <input type="hidden" name="op" value="role" />
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Critical role
            <input name="title" required placeholder="Head of Production" className={input} />
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Impact
            <select name="impact" className={input}>
              {['critical', 'high', 'medium'].map((i) => <option key={i}>{i}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Incumbent
            <select name="incumbentNumber" className={input}>
              <option value="">—</option>
              {data!.employees.map((e) => (
                <option key={e.employee_number} value={e.employee_number}>{e.employee_number} · {e.full_name}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-600 transition-colors">
            Add role
          </button>
        </form>

        <div className="space-y-4">
          {data!.roles.length === 0 && (
            <p className="font-heading italic text-mute-3">No critical roles identified yet.</p>
          )}
          {data!.roles.map((r) => {
            const bench = data!.successors.filter((s) => s.role_id === r.id);
            return (
              <section key={r.id} className="rounded-lg border border-line bg-ink px-5 py-4">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <span className="text-sm font-semibold text-chalk">{r.title}</span>
                  <span className={`text-xs font-semibold uppercase ${r.business_impact === 'critical' ? 'text-red-600' : 'text-mute-2'}`}>
                    {r.business_impact}
                  </span>
                  <span className="text-xs text-mute-2">incumbent: {r.incumbent ?? '—'}</span>
                  {bench.length === 0 && (
                    <span className="text-xs font-bold text-red-600 ml-auto">NO SUCCESSOR</span>
                  )}
                </div>
                {bench.length > 0 && (
                  <ul className="mb-3 space-y-1">
                    {bench.map((s) => (
                      <li key={s.id} className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="font-semibold">{s.full_name}</span>
                        <span className="text-xs text-mute-3">{s.rank}</span>
                        <span className={`text-xs font-semibold ${READY_STYLE[s.readiness]}`}>{s.readiness}</span>
                        <form method="post" action="/api/succession" className="flex gap-1.5">
                          <input type="hidden" name="op" value="readiness" />
                          <input type="hidden" name="successorId" value={s.id} />
                          <select name="readiness" defaultValue={s.readiness} className="rounded border border-line bg-ink px-1.5 py-0.5 text-xs">
                            {READINESS.map((x) => <option key={x}>{x}</option>)}
                          </select>
                          <button type="submit" className="px-2 py-0.5 text-xs rounded border border-line text-mute-2 hover:border-brand hover:text-brand">
                            set
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                )}
                <form method="post" action="/api/succession" className="flex flex-wrap items-end gap-2 pt-3 border-t border-line">
                  <input type="hidden" name="op" value="successor" />
                  <input type="hidden" name="roleId" value={r.id} />
                  <select name="employeeNumber" className={`${input} text-xs`}>
                    {data!.employees.map((e) => (
                      <option key={e.employee_number} value={e.employee_number}>{e.employee_number} · {e.full_name}</option>
                    ))}
                  </select>
                  <select name="rank" className={`${input} text-xs`}>
                    {['primary', 'secondary', 'emergency'].map((x) => <option key={x}>{x}</option>)}
                  </select>
                  <select name="readiness" className={`${input} text-xs`}>
                    {READINESS.map((x) => <option key={x}>{x}</option>)}
                  </select>
                  <button type="submit" className="px-3 py-2 border border-brand text-brand text-xs font-medium rounded-md hover:bg-brand hover:text-white transition-colors">
                    Add successor
                  </button>
                </form>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
