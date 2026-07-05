import Link from 'next/link';
import { cp } from '../lib/cp';

export const dynamic = 'force-dynamic';

interface TenantRow {
  slug: string;
  display_name: string;
  tier: string;
  status: string;
  billing_status: string;
  deployed_version: string | null;
  hostname: string | null;
  run_status: string | null;
}

const input =
  'border border-line bg-ink px-4 py-3 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand';

export default async function TenantList() {
  const sql = cp();
  const tenants = await sql<TenantRow[]>`
    select t.slug, t.display_name, t.tier, t.status, t.billing_status, t.deployed_version,
      (select hostname from tenant_domains d where d.tenant_id = t.id and d.is_primary limit 1) as hostname,
      (select r.status::text from provisioning_runs r where r.tenant_id = t.id
        order by r.created_at desc limit 1) as run_status
    from tenants t order by t.created_at desc`;

  return (
    <main className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-12 py-16">
        <p className="font-body text-xs tracking-widest3 text-brand uppercase mb-4">
          Control Plane · System Admin
        </p>
        <div className="flex flex-wrap items-baseline gap-6 mb-12">
          <h1 className="font-display text-chalk leading-[0.92]" style={{ fontSize: 'clamp(40px, 5vw, 72px)' }}>
            TENANTS
          </h1>
          <Link href="/prospects" className="font-body text-sm text-brand underline">
            Prospects →
          </Link>
        </div>

        {/* create tenant → enqueues a run; the worker provisions unattended */}
        <form
          method="post"
          action="/api/tenants"
          className="flex flex-wrap items-end gap-3 border border-line bg-surface p-6 mb-12"
        >
          <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
            Slug
            <input name="slug" required pattern="[a-z][a-z0-9-]{1,30}" placeholder="acme" className={input} />
          </label>
          <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
            Company name
            <input name="name" placeholder="Acme Holdings" className={input} />
          </label>
          <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
            Tier
            <select name="tier" defaultValue="L1" className={input}>
              {['L1', 'L2', 'L3', 'L4', 'L5'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
            Brand color
            <input name="brand" placeholder="#4F46E5" pattern="#[0-9a-fA-F]{6}" className={input} />
          </label>
          <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
            Logo URL
            <input name="logoUrl" placeholder="https://…/logo.png" className={input} />
          </label>
          <button
            type="submit"
            className="px-8 py-3 bg-brand-gradient text-white font-display text-base tracking-widest uppercase shadow-brand"
          >
            Create tenant
          </button>
        </form>

        <div className="border border-line overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left">
                {['Tenant', 'Tier', 'Status', 'Last run', 'Billing', 'Domain', 'Version'].map((h) => (
                  <th key={h} className="px-5 py-3 font-body text-xs uppercase tracking-widest text-mute-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-mute-3 font-heading italic text-base">
                    No tenants yet — create the first one above.
                  </td>
                </tr>
              )}
              {tenants.map((t) => (
                <tr key={t.slug} className="border-b border-line last:border-b-0 hover:bg-brand-50 transition-colors">
                  <td className="px-5 py-4">
                    <Link href={`/tenants/${t.slug}`} className="text-brand font-semibold">
                      {t.display_name}
                    </Link>
                    <span className="text-mute-3 ml-2">{t.slug}</span>
                  </td>
                  <td className="px-5 py-4 font-display text-lg text-chalk">{t.tier}</td>
                  <td className="px-5 py-4">{t.status}</td>
                  <td className="px-5 py-4">{t.run_status ?? '—'}</td>
                  <td className="px-5 py-4">{t.billing_status}</td>
                  <td className="px-5 py-4 text-mute-2">{t.hostname ?? '—'}</td>
                  <td className="px-5 py-4 text-mute-2">{t.deployed_version ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
