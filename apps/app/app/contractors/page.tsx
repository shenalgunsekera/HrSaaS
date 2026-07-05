import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';

export const dynamic = 'force-dynamic';

const input =
  'border border-line bg-ink px-4 py-3 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand';

/** Contractor & Gig Workforce (L1): register + expiry compliance strip. */
export default async function ContractorsPage() {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  const data = await withTenantDb(async (db) => {
    const rows = await db<
      { contractor_number: string; full_name: string; contractor_type: string;
        engagement_basis: string; rate: string; agency: string | null;
        contract_start: string; contract_end: string | null; status: string;
        expiring: boolean }[]
    >`select contractor_number, full_name, contractor_type, engagement_basis, rate, agency,
        to_char(contract_start,'YYYY-MM-DD') as contract_start,
        to_char(contract_end,'YYYY-MM-DD') as contract_end, status,
        (status = 'active' and contract_end is not null
         and contract_end <= current_date + interval '30 days') as expiring
      from contractors order by contract_end nulls last, contractor_number`;
    const [stats] = await db<[{ active: string; expiring: string; agencies: string }]>`
      select
        (select count(*) from contractors where status = 'active')::text as active,
        (select count(*) from contractors where status = 'active' and contract_end is not null
           and contract_end <= current_date + interval '30 days')::text as expiring,
        (select count(distinct agency) from contractors where agency is not null)::text as agencies`;
    return { rows, stats };
  });

  return (
    <main className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-12 py-16">
        <p className="font-body text-xs tracking-widest3 text-brand uppercase mb-4">
          Contractor &amp; Gig Workforce · {ctx.slug}
        </p>
        <h1 className="font-display text-chalk leading-[0.92] mb-10" style={{ fontSize: 'clamp(40px, 5vw, 72px)' }}>
          CONTRACTORS
        </h1>

        <div className="grid grid-cols-3 gap-px bg-line border border-line mb-10">
          {[
            { k: data!.stats.active, v: 'Active contractors', warn: false },
            { k: data!.stats.expiring, v: 'Contracts expiring ≤30 days', warn: Number(data!.stats.expiring) > 0 },
            { k: data!.stats.agencies, v: 'Agencies engaged', warn: false },
          ].map((s) => (
            <div key={s.v} className="bg-ink px-6 py-5 hover:bg-brand-50 transition-colors">
              <div className={`font-display text-3xl ${s.warn ? 'text-red-600' : 'text-brand'}`}>{s.k}</div>
              <div className="font-body text-xs text-mute-2 mt-1">{s.v}</div>
            </div>
          ))}
        </div>

        <form method="post" action="/api/contractors" className="flex flex-wrap items-end gap-3 border border-line bg-surface p-6 mb-10">
          {[
            ['contractorNumber', 'Contractor №', 'CTR-001', 'text'],
            ['fullName', 'Full name', '', 'text'],
            ['rate', 'Rate (LKR)', '5000', 'number'],
            ['agency', 'Agency', '', 'text'],
            ['contractStart', 'Start', '', 'date'],
            ['contractEnd', 'End', '', 'date'],
          ].map(([name, label, ph, type]) => (
            <label key={name} className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
              {label}
              <input name={name} placeholder={ph} type={type}
                required={['contractorNumber', 'fullName', 'rate', 'contractStart'].includes(name!)}
                className={input} />
            </label>
          ))}
          <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
            Type
            <select name="contractorType" className={input}>
              {['fixed-term', 'casual', 'gig', 'outsourced', 'retainer'].map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
            Basis
            <select name="engagementBasis" className={input}>
              {['daily', 'piece-rate', 'project', 'hourly'].map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>
          <button type="submit" className="px-8 py-3 bg-brand-gradient text-white font-display text-base tracking-widest uppercase shadow-brand">
            Register
          </button>
        </form>

        <div className="border border-line overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left">
                {['№', 'Name', 'Type', 'Basis', 'Rate', 'Agency', 'Contract', 'Status'].map((h) => (
                  <th key={h} className="px-5 py-3 font-body text-xs uppercase tracking-widest text-mute-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data!.rows.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-8 font-heading italic text-mute-3">No contractors yet.</td></tr>
              )}
              {data!.rows.map((c) => (
                <tr key={c.contractor_number} className="border-b border-line last:border-b-0 hover:bg-brand-50 transition-colors">
                  <td className="px-5 py-3 text-mute-2">{c.contractor_number}</td>
                  <td className="px-5 py-3 font-semibold">{c.full_name}</td>
                  <td className="px-5 py-3">{c.contractor_type}</td>
                  <td className="px-5 py-3">{c.engagement_basis}</td>
                  <td className="px-5 py-3">{Number(c.rate).toLocaleString()}</td>
                  <td className="px-5 py-3">{c.agency ?? '—'}</td>
                  <td className={`px-5 py-3 ${c.expiring ? 'text-red-600 font-semibold' : 'text-mute-2'}`}>
                    {c.contract_start} → {c.contract_end ?? 'open'}{c.expiring ? ' · EXPIRING' : ''}
                  </td>
                  <td className="px-5 py-3">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
