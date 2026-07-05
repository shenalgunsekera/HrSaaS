import Link from 'next/link';
import { cp } from '../../lib/cp';

export const dynamic = 'force-dynamic';

interface ProspectRow {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  headcount: number | null;
  interested_tier: string | null;
  consultation_at: string | null;
  scheduler_ref: string | null;
  converted_tenant_id: string | null;
  converted_slug: string | null;
  created_at: string;
}

const input =
  'rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand';

/** Prospect pipeline: booked consultations → one-click tenant conversion. */
export default async function Prospects() {
  const sql = cp();
  const prospects = await sql<ProspectRow[]>`
    select p.*, t.slug as converted_slug
    from prospects p left join tenants t on t.id = p.converted_tenant_id
    order by p.created_at desc`;

  return (
    <main className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <Link href="/" className="font-body text-xs font-semibold tracking-wider text-brand uppercase">
          ← Tenants
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-chalk mt-3 mb-8">
          Prospects
        </h1>

        <div className="space-y-4">
          {prospects.length === 0 && (
            <p className="font-heading italic text-mute-3">
              No consultations booked yet — leads from the marketing site land here.
            </p>
          )}
          {prospects.map((p) => (
            <div key={p.id} className="rounded-lg border border-line bg-ink p-5 flex flex-wrap items-center gap-6 hover:bg-brand-50 transition-colors">
              <div className="min-w-64">
                <div className="text-lg font-semibold text-chalk">{p.company_name}</div>
                <div className="font-body text-sm text-mute-2 mt-1">
                  {p.contact_name} · {p.email}
                  {p.phone ? ` · ${p.phone}` : ''}
                </div>
                <div className="font-body text-xs text-mute-3 mt-1">
                  {p.headcount ? `${p.headcount} employees · ` : ''}
                  {p.interested_tier ? `interested in ${p.interested_tier} · ` : ''}
                  booked {p.scheduler_ref ?? '—'}
                  {p.consultation_at ? ` for ${new Date(p.consultation_at).toLocaleString()}` : ''}
                </div>
              </div>
              {p.converted_tenant_id ? (
                <Link href={`/tenants/${p.converted_slug}`} className="ml-auto font-body text-sm text-brand underline">
                  Converted → {p.converted_slug}
                </Link>
              ) : (
                <form method="post" action={`/api/prospects/${p.id}/convert`} className="ml-auto flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
                    Slug
                    <input name="slug" required pattern="[a-z][a-z0-9-]{1,30}" placeholder="acme" className={input} />
                  </label>
                  <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
                    Tier
                    <select name="tier" defaultValue={p.interested_tier ?? 'L1'} className={input}>
                      {['L1', 'L2', 'L3', 'L4', 'L5'].map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
                    Brand
                    <input name="brand" placeholder="#4F46E5" pattern="#[0-9a-fA-F]{6}" className={input} />
                  </label>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-brand text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-600 transition-colors"
                  >
                    Convert to tenant
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
