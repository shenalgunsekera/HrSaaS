import Link from 'next/link';
import { MODULES, canUseModule } from '@hr/entitlements';
import { getTenantContext } from '../../lib/tenant';
import { listObjects, withTenantDb } from '../../lib/objects';

export const dynamic = 'force-dynamic';

const input =
  'border border-line bg-ink px-4 py-3 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand';

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
      <div className="absolute inset-0 bg-grid pointer-events-none" aria-hidden="true" />
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-12 py-16">
        <p className="font-body text-xs tracking-widest3 text-brand uppercase mb-4">
          Schema Engine · {ctx.slug}
        </p>
        <h1 className="font-display text-chalk leading-[0.92] mb-4" style={{ fontSize: 'clamp(40px, 5vw, 72px)' }}>
          OBJECTS &amp; FIELDS
        </h1>
        <p className="font-heading italic text-lg text-mute-1 mb-10 max-w-2xl">
          Definitions are data — changes go live on publish, no deploy. You can only
          build within modules this company is entitled to.
        </p>

        <form
          method="post"
          action="/api/objects"
          className="flex flex-wrap items-end gap-3 border border-line bg-surface p-6 mb-12"
        >
          <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
            Object name
            <input name="label" required placeholder="Site Safety Record" className={input} />
          </label>
          <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
            Module
            <select name="moduleKey" className={input}>
              {entitledModules.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
            Start from
            <select name="template" className={input}>
              <option value="">Blank object</option>
              <option value="employee-master">Template: Employee Master (feature sheet A–K)</option>
            </select>
          </label>
          <button
            type="submit"
            className="px-8 py-3 bg-brand-gradient text-white font-display text-base tracking-widest uppercase shadow-brand"
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
              <div className="font-display text-2xl text-chalk tracking-wide">
                {o.label.toUpperCase()}
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
