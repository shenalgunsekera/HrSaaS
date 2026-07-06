import { canUseModule } from '@hr/entitlements';
import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';
import { ExportBar } from '../../components/ExportBar';

export const dynamic = 'force-dynamic';

const input =
  'rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand';
const fmt = (v: string | number) => Number(v).toLocaleString();

/** Multi-Entity / Multi-Country Payroll (L3): entities + consolidated rollup. */
export default async function EntitiesPage() {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  if (!canUseModule(ctx.entitlements, 'multi-entity-payroll')) {
    return (
      <main className="min-h-svh flex items-center justify-center px-6">
        <p className="font-body text-sm text-mute-2 max-w-md text-center">
          Multi-Entity / Multi-Country Payroll is available from level L3. Your company runs {ctx.tier}.
        </p>
      </main>
    );
  }

  const data = await withTenantDb(async (db) => {
    const entities = await db<
      { id: string; name: string; country: string; currency: string;
        headcount: number; payroll: string }[]
    >`select le.id, le.name, le.country, le.currency,
        (select count(*) from employees e where e.entity_id = le.id and e.status='active')::int as headcount,
        coalesce((select sum(e.basic_salary) from employees e where e.entity_id = le.id and e.status='active'), 0)::text as payroll
      from legal_entities le order by le.name`;
    const [unassigned] = await db<[{ n: number; cost: string }]>`
      select count(*)::int as n, coalesce(sum(basic_salary),0)::text as cost
      from employees where entity_id is null and status='active'`;
    const employees = await db<{ employee_number: string; full_name: string; entity: string | null }[]>`
      select e.employee_number, e.full_name, le.name as entity
      from employees e left join legal_entities le on le.id = e.entity_id
      where e.status='active' order by e.employee_number`;
    return { entities, unassigned, employees };
  });

  const groupTotal = data!.entities.reduce((a, e) => a + Number(e.payroll), 0) + Number(data!.unassigned.cost);
  const groupHc = data!.entities.reduce((a, e) => a + e.headcount, 0) + data!.unassigned.n;

  return (
    <main className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
          Multi-Entity Payroll · {ctx.slug}
        </p>
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-chalk">Multi-Entity Payroll</h1>
          <ExportBar entity="legal-entities" />
        </div>

        <div className="grid grid-cols-3 gap-px bg-line border border-line mb-8">
          {[
            { k: String(data!.entities.length), v: 'Legal entities' },
            { k: String(groupHc), v: 'Group headcount' },
            { k: fmt(groupTotal), v: 'Group monthly basic (LKR-equiv)' },
          ].map((s) => (
            <div key={s.v} className="bg-ink px-6 py-5 hover:bg-brand-50 transition-colors">
              <div className="text-2xl font-bold text-brand">{s.k}</div>
              <div className="font-body text-xs text-mute-2 mt-1">{s.v}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <form method="post" action="/api/entities" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5">
            <input type="hidden" name="op" value="entity" />
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Legal entity
              <input name="name" required placeholder="Hemas Textiles (Pvt) Ltd" className={input} />
            </label>
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Country
              <input name="country" defaultValue="LK" maxLength={2} className={`${input} w-16`} />
            </label>
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Currency
              <input name="currency" defaultValue="LKR" maxLength={3} className={`${input} w-20`} />
            </label>
            <button type="submit" className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-600 transition-colors">Add entity</button>
          </form>

          <form method="post" action="/api/entities" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5">
            <input type="hidden" name="op" value="assign" />
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Employee
              <select name="employeeNumber" className={input}>
                {data!.employees.map((e) => <option key={e.employee_number} value={e.employee_number}>{e.employee_number} · {e.full_name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
              Entity
              <select name="entityName" className={input}>
                {data!.entities.map((e) => <option key={e.id}>{e.name}</option>)}
              </select>
            </label>
            <button type="submit" className="px-4 py-2.5 border border-brand text-brand text-sm font-medium rounded-md hover:bg-brand hover:text-white transition-colors">Assign</button>
          </form>
        </div>

        <h2 className="text-xl font-bold tracking-tight text-chalk mb-3">Consolidated by entity</h2>
        <div className="rounded-lg border border-line overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left">
                {['Entity', 'Country', 'Currency', 'Headcount', 'Monthly basic'].map((h) => (
                  <th key={h} className="px-5 py-3 font-body text-xs font-semibold text-mute-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data!.entities.map((e) => (
                <tr key={e.id} className="border-b border-line hover:bg-brand-50 transition-colors">
                  <td className="px-5 py-3 font-semibold">{e.name}</td>
                  <td className="px-5 py-3">{e.country}</td>
                  <td className="px-5 py-3">{e.currency}</td>
                  <td className="px-5 py-3">{e.headcount}</td>
                  <td className="px-5 py-3">{fmt(e.payroll)}</td>
                </tr>
              ))}
              {data!.unassigned.n > 0 && (
                <tr className="border-b border-line text-mute-2">
                  <td className="px-5 py-3 italic">Unassigned (primary entity)</td>
                  <td className="px-5 py-3">LK</td>
                  <td className="px-5 py-3">LKR</td>
                  <td className="px-5 py-3">{data!.unassigned.n}</td>
                  <td className="px-5 py-3">{fmt(data!.unassigned.cost)}</td>
                </tr>
              )}
              <tr className="bg-surface font-bold">
                <td className="px-5 py-3" colSpan={3}>Group total</td>
                <td className="px-5 py-3">{groupHc}</td>
                <td className="px-5 py-3 text-brand">{fmt(groupTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
