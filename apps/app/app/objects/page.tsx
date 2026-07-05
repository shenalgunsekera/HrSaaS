import Link from 'next/link';
import { MODULES, canUseModule } from '@hr/entitlements';
import { getTenantContext } from '../../lib/tenant';
import { listObjects, withTenantDb } from '../../lib/objects';

export const dynamic = 'force-dynamic';

const input =
  'rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand';

/** Object wizard home: existing definitions + create (blank or from template). */
export default async function ObjectsPage() {
  const ctx = await getTenantContext();
  if (!ctx) {
    return (
      <main className="min-h-svh flex items-center justify-center">
        <p className="font-heading italic text-xl text-mute-1">No tenant resolved.</p>
      </main>
    );
  }
  const objects = (await withTenantDb((db) => listObjects(db))) ?? [];
  const entitledModules = MODULES.filter((m) => canUseModule(ctx.entitlements, m.key));
  const themeVars = (ctx.theme?.colors ?? {}) as React.CSSProperties;

  return (
    <main style={themeVars} className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
          Schema Engine · {ctx.slug}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-chalk mb-3">
          Objects &amp; Fields
        </h1>
        <p className="font-heading italic text-lg text-mute-1 mb-10 max-w-2xl">
          Definitions are data — changes go live on publish, no deploy. You can only
          build within modules this company is entitled to.
        </p>

        <form
          method="post"
          action="/api/objects"
          className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5 mb-12"
        >
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Object name
            <input name="label" required placeholder="Site Safety Record" className={input} />
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Module
            <select name="moduleKey" className={input}>
              {entitledModules.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Start from
            <select name="template" className={input}>
              <option value="">Blank object</option>
              <option value="employee-master">Template: Employee Master (feature sheet A–K)</option>
            </select>
          </label>
          <button
            type="submit"
            className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-600 transition-colors"
          >
            Create object
          </button>
        </form>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-line border border-line">
          {objects.length === 0 && (
            <div className="bg-ink px-6 py-8 font-heading italic text-mute-3 sm:col-span-2 lg:col-span-3">
              No custom objects yet.
            </div>
          )}
          {objects.map((o) => (
            <Link
              key={o.key}
              href={`/objects/${o.key}`}
              className="bg-ink px-6 py-6 hover:bg-brand-50 transition-colors duration-300 block"
            >
              <div className="text-lg font-semibold text-chalk">
                {o.label}
              </div>
              <div className="font-body text-xs text-mute-2 mt-1">
                {o.fields.length} fields · v{o.version} · {o.moduleKey}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
