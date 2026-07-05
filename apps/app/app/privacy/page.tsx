import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';

export const dynamic = 'force-dynamic';

const input =
  'border border-line bg-ink px-4 py-3 font-body text-sm text-chalk focus:outline-none focus:border-brand';
const PURPOSES = ['hr-administration', 'payroll-processing', 'statutory-reporting', 'communications', 'analytics'];

/** Data Privacy & Consent (L1, PDPA): consent register + DSR queue + dashboard. */
export default async function PrivacyPage() {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  const data = await withTenantDb(async (db) => {
    const employees = await db<{ employee_number: string; full_name: string }[]>`
      select employee_number, full_name from employees order by employee_number`;
    const consents = await db<
      { employee_number: string; full_name: string; purpose: string;
        granted_at: string; withdrawn_at: string | null }[]
    >`select e.employee_number, e.full_name, c.purpose,
        to_char(c.granted_at,'YYYY-MM-DD') as granted_at,
        to_char(c.withdrawn_at,'YYYY-MM-DD') as withdrawn_at
      from consents c join employees e on e.id = c.employee_id
      order by e.employee_number, c.purpose`;
    const dsrs = await db<
      { id: string; employee_number: string; full_name: string; kind: string; detail: string | null;
        status: string; due_at: string; overdue: boolean; resolved_at: string | null }[]
    >`select d.id, e.employee_number, e.full_name, d.kind, d.detail, d.status,
        to_char(d.due_at,'YYYY-MM-DD') as due_at,
        (d.status = 'open' and d.due_at < now()) as overdue,
        to_char(d.resolved_at,'YYYY-MM-DD') as resolved_at
      from data_subject_requests d join employees e on e.id = d.employee_id
      order by d.created_at desc limit 100`;
    const [stats] = await db<
      [{ active_consents: string; withdrawn: string; open_dsrs: string; overdue_dsrs: string }]
    >`select
        (select count(*) from consents where withdrawn_at is null)::text as active_consents,
        (select count(*) from consents where withdrawn_at is not null)::text as withdrawn,
        (select count(*) from data_subject_requests where status = 'open')::text as open_dsrs,
        (select count(*) from data_subject_requests where status = 'open' and due_at < now())::text as overdue_dsrs`;
    return { employees, consents, dsrs, stats };
  });
  const themeVars = (ctx.theme?.colors ?? {}) as React.CSSProperties;

  return (
    <main style={themeVars} className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-12 py-16">
        <p className="font-body text-xs tracking-widest3 text-brand uppercase mb-4">
          Data Privacy &amp; Consent · {ctx.slug} · PDPA
        </p>
        <h1 className="font-display text-chalk leading-[0.92] mb-10" style={{ fontSize: 'clamp(40px, 5vw, 72px)' }}>
          PRIVACY
        </h1>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line mb-10">
          {[
            { k: data!.stats.active_consents, v: 'Active consents' },
            { k: data!.stats.withdrawn, v: 'Withdrawn' },
            { k: data!.stats.open_dsrs, v: 'Open data-subject requests' },
            { k: data!.stats.overdue_dsrs, v: 'Overdue (30-day SLA)' },
          ].map((s) => (
            <div key={s.v} className="bg-ink px-6 py-5 hover:bg-brand-50 transition-colors">
              <div className={`font-display text-3xl ${s.v.startsWith('Overdue') && Number(s.k) > 0 ? 'text-red-600' : 'text-brand'}`}>{s.k}</div>
              <div className="font-body text-xs text-mute-2 mt-1">{s.v}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-10">
          <form method="post" action="/api/privacy/consents" className="flex flex-wrap items-end gap-3 border border-line bg-surface p-6">
            <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
              Employee
              <select name="employeeNumber" className={input}>
                {data!.employees.map((e) => (
                  <option key={e.employee_number} value={e.employee_number}>{e.employee_number} · {e.full_name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
              Purpose
              <select name="purpose" className={input}>
                {PURPOSES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
              Action
              <select name="action" className={input}>
                <option>grant</option>
                <option>withdraw</option>
              </select>
            </label>
            <button type="submit" className="px-6 py-3 bg-brand-gradient text-white font-display text-sm tracking-widest uppercase shadow-brand">
              Record consent
            </button>
          </form>

          <form method="post" action="/api/privacy/dsr" className="flex flex-wrap items-end gap-3 border border-line bg-surface p-6">
            <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
              Employee
              <select name="employeeNumber" className={input}>
                {data!.employees.map((e) => (
                  <option key={e.employee_number} value={e.employee_number}>{e.employee_number} · {e.full_name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
              Request
              <select name="kind" className={input}>
                {['access', 'correction', 'erasure', 'portability'].map((k) => <option key={k}>{k}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
              Detail
              <input name="detail" className={input} />
            </label>
            <button type="submit" className="px-6 py-3 border border-brand text-brand font-display text-sm tracking-widest uppercase hover:bg-brand hover:text-white transition-colors">
              File DSR
            </button>
          </form>
        </div>

        <p className="font-body text-xs tracking-widest3 text-brand uppercase mb-3">Data-subject requests</p>
        <div className="space-y-3 mb-10">
          {data!.dsrs.length === 0 && <p className="font-heading italic text-mute-3">None filed.</p>}
          {data!.dsrs.map((d) => (
            <div key={d.id} className="border border-line bg-ink px-6 py-4 flex flex-wrap items-center gap-5 hover:bg-brand-50 transition-colors">
              <span className="font-body font-semibold text-sm min-w-44">{d.full_name} <span className="text-mute-3">{d.employee_number}</span></span>
              <span className="font-body text-xs uppercase tracking-wider px-3 py-1 border border-line text-mute-1">{d.kind}</span>
              {d.detail && <span className="font-heading italic text-sm text-mute-2">“{d.detail}”</span>}
              <span className={`font-body text-xs ${d.overdue ? 'text-red-600 font-bold' : 'text-mute-2'}`}>
                due {d.due_at}{d.overdue ? ' · OVERDUE' : ''}
              </span>
              <span className={`ml-auto font-body text-xs uppercase tracking-wider font-semibold ${
                d.status === 'resolved' ? 'text-brand' : d.status === 'rejected' ? 'text-red-600' : 'text-amber-600'
              }`}>
                {d.status}{d.resolved_at ? ` ${d.resolved_at}` : ''}
              </span>
              {d.status === 'open' && (
                <form method="post" action={`/api/privacy/dsr/${d.id}/resolve`}>
                  <input type="hidden" name="action" value="resolve" />
                  <input type="hidden" name="_role" value="hr" />
                  <button type="submit" className="px-4 py-1.5 font-body text-xs uppercase tracking-wider border border-brand text-brand hover:bg-brand hover:text-white transition-colors">
                    resolve
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>

        <p className="font-body text-xs tracking-widest3 text-brand uppercase mb-3">Consent register</p>
        <div className="border border-line overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left">
                {['Employee', 'Purpose', 'Granted', 'Status'].map((h) => (
                  <th key={h} className="px-5 py-3 font-body text-xs uppercase tracking-widest text-mute-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data!.consents.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-8 font-heading italic text-mute-3">No consents recorded.</td></tr>
              )}
              {data!.consents.map((c) => (
                <tr key={`${c.employee_number}-${c.purpose}`} className="border-b border-line last:border-b-0 hover:bg-brand-50 transition-colors">
                  <td className="px-5 py-3 font-semibold">{c.full_name} <span className="text-mute-3">{c.employee_number}</span></td>
                  <td className="px-5 py-3">{c.purpose}</td>
                  <td className="px-5 py-3 text-mute-2">{c.granted_at}</td>
                  <td className={`px-5 py-3 font-semibold ${c.withdrawn_at ? 'text-red-600' : 'text-brand'}`}>
                    {c.withdrawn_at ? `withdrawn ${c.withdrawn_at}` : 'active'}
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
