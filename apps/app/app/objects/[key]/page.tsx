import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FIELD_TYPES } from '@hr/schema-engine';
import { getTenantContext } from '../../../lib/tenant';
import { getObject, withTenantDb } from '../../../lib/objects';

export const dynamic = 'force-dynamic';

const input =
  'rounded-md border border-line bg-ink px-3 py-2 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand';

/** The builder: add/remove fields; every change publishes a new version. */
export default async function ObjectBuilder(routeCtx: { params: Promise<{ key: string }> }) {
  const { key } = await routeCtx.params;
  const ctx = await getTenantContext();
  if (!ctx) notFound();
  const def = await withTenantDb((db) => getObject(db, key));
  if (!def) notFound();
  const themeVars = (ctx.theme?.colors ?? {}) as React.CSSProperties;

  return (
    <main style={themeVars} className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <Link href="/objects" className="font-body text-xs font-semibold tracking-wider text-brand uppercase">
          ← All objects
        </Link>
        <div className="flex flex-wrap items-baseline gap-4 mt-4 mb-2">
          <h1 className="text-3xl font-bold tracking-tight text-chalk">
            {def.label}
          </h1>
          <span className="font-body text-sm text-mute-2">
            v{def.version} · {def.moduleKey} · {def.kind}
          </span>
        </div>
        <p className="font-heading italic text-mute-1 mb-8">
          <Link href={`/objects/${key}/records`} className="text-brand underline">
            Open generated form &amp; records →
          </Link>
        </p>

        {/* add field */}
        <form
          method="post"
          action={`/api/objects/${key}/fields`}
          className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-5 mb-10"
        >
          <input type="hidden" name="op" value="add" />
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Field label
            <input name="label" required placeholder="Incident Severity" className={input} />
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Type
            <select name="type" className={input}>
              {FIELD_TYPES.filter((t) => t !== 'section' && t !== 'computed').map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Options (select types, comma-sep)
            <input name="options" placeholder="Low, Medium, High" className={input} />
          </label>
          <label className="flex flex-col gap-1 font-body text-xs font-medium text-mute-1">
            Visible to roles (empty = all)
            <input name="visibleToRoles" placeholder="hr, tenant-admin" className={input} />
          </label>
          <label className="flex items-center gap-2 font-body text-xs font-medium text-mute-1 pb-3">
            <input type="checkbox" name="required" /> required
          </label>
          <button
            type="submit"
            className="px-4 py-2.5 bg-brand text-white text-sm font-semibold rounded-md shadow-sm hover:bg-brand-600 transition-colors"
          >
            Add field
          </button>
        </form>

        {/* field list grouped by section */}
        {def.sections
          .slice()
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((s) => {
            const fields = def.fields
              .filter((f) => f.sectionKey === s.key)
              .sort((a, b) => a.displayOrder - b.displayOrder);
            if (fields.length === 0) return null;
            return (
              <section key={s.key} className="mb-8">
                <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-3">
                  {s.label}
                </p>
                <div className="border border-line divide-y divide-line">
                  {fields.map((f) => (
                    <div key={f.key} className="flex flex-wrap items-center gap-4 px-5 py-3 bg-ink hover:bg-brand-50 transition-colors">
                      <span className="font-body font-semibold text-sm text-chalk min-w-48">{f.label}</span>
                      <span className="font-body text-xs text-mute-2">{f.type}</span>
                      {f.validation?.required && (
                        <span className="font-body text-[11px] uppercase tracking-wider text-brand">required</span>
                      )}
                      {f.validation?.options && (
                        <span className="font-body text-xs text-mute-3">[{f.validation.options.join(' · ')}]</span>
                      )}
                      {f.visibleToRoles && (
                        <span className="font-body text-[11px] uppercase tracking-wider text-mute-2">
                          visible: {f.visibleToRoles.join(', ')}
                        </span>
                      )}
                      <form method="post" action={`/api/objects/${key}/fields`} className="ml-auto">
                        <input type="hidden" name="op" value="remove" />
                        <input type="hidden" name="fieldKey" value={f.key} />
                        <button type="submit" className="font-body text-xs text-mute-3 hover:text-red-600 uppercase tracking-wider">
                          remove
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
      </div>
    </main>
  );
}
