import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';

export const dynamic = 'force-dynamic';

const input =
  'rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand';

/** Integrations & API (L1): key management + public API reference. */
export default async function IntegrationsPage(props: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key: freshKey } = await props.searchParams;
  const ctx = await getTenantContext();
  if (!ctx) return null;
  const keys =
    (await withTenantDb((db) =>
      db<
        { id: string; name: string; prefix: string; created_at: string;
          last_used_at: string | null; revoked_at: string | null }[]
      >`select id, name, prefix, to_char(created_at,'YYYY-MM-DD') as created_at,
          to_char(last_used_at,'YYYY-MM-DD HH24:MI') as last_used_at,
          to_char(revoked_at,'YYYY-MM-DD') as revoked_at
        from api_keys order by created_at desc`,
    )) ?? [];

  return (
    <main className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
          Integrations &amp; API · {ctx.slug}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-chalk mb-8">API keys</h1>

        {freshKey && (
          <div className="rounded-lg border border-brand bg-brand-50 p-5 mb-8">
            <p className="text-sm font-semibold text-chalk mb-1">Copy your new key now — it will never be shown again.</p>
            <code className="font-mono text-sm text-brand break-all">{freshKey}</code>
          </div>
        )}

        <form method="post" action="/api/integrations/keys" className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5 mb-8">
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Key name
            <input name="name" required placeholder="Accounting sync" className={input} />
          </label>
          <button type="submit" className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-600 transition-colors">
            Create key
          </button>
          <p className="font-body text-xs text-mute-3 pb-3">
            Use with <code className="font-mono">Authorization: Bearer hrk_…</code> against{' '}
            <code className="font-mono">GET /api/v1/employees</code>. Only a SHA-256 hash is stored.
          </p>
        </form>

        <div className="rounded-lg border border-line overflow-x-auto">
          <table className="w-full font-body text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-left">
                {['Name', 'Prefix', 'Created', 'Last used', 'Status', ''].map((h, i) => (
                  <th key={i} className="px-5 py-3 font-body text-xs font-semibold text-mute-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 font-heading italic text-mute-3">No API keys yet.</td></tr>
              )}
              {keys.map((k) => (
                <tr key={k.id} className="border-b border-line last:border-b-0 hover:bg-brand-50 transition-colors">
                  <td className="px-5 py-3 font-semibold">{k.name}</td>
                  <td className="px-5 py-3 font-mono text-mute-2">hrk_{k.prefix}_…</td>
                  <td className="px-5 py-3 text-mute-2">{k.created_at}</td>
                  <td className="px-5 py-3 text-mute-2">{k.last_used_at ?? 'never'}</td>
                  <td className={`px-5 py-3 font-semibold ${k.revoked_at ? 'text-red-600' : 'text-brand'}`}>
                    {k.revoked_at ? `revoked ${k.revoked_at}` : 'active'}
                  </td>
                  <td className="px-5 py-3">
                    {!k.revoked_at && (
                      <form method="post" action={`/api/integrations/keys/${k.id}/revoke`}>
                        <button type="submit" className="text-xs font-medium text-mute-2 hover:text-red-600">
                          Revoke
                        </button>
                      </form>
                    )}
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
