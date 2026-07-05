import Link from 'next/link';
import { notFound } from 'next/navigation';
import postgres from 'postgres';
import { editableFields, visibleFields, type FieldDefinition } from '@hr/schema-engine';
import { ROLES } from '@hr/rbac';
import { getTenantContext } from '../../../../lib/tenant';
import { getObject } from '../../../../lib/objects';

export const dynamic = 'force-dynamic';

const input =
  'border border-line bg-ink px-4 py-3 font-body text-sm text-chalk placeholder:text-mute-3 focus:outline-none focus:border-brand w-full';

function FieldInput({ f }: { f: FieldDefinition }) {
  const required = f.validation?.required;
  switch (f.type) {
    case 'longText':
      return <textarea name={f.key} required={required} rows={3} className={input} />;
    case 'boolean':
      return (
        <select name={f.key} required={required} className={input}>
          <option value="">—</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    case 'singleSelect':
      return (
        <select name={f.key} required={required} className={input}>
          <option value="">—</option>
          {f.validation?.options?.map((o) => <option key={o}>{o}</option>)}
        </select>
      );
    case 'multiSelect':
      return (
        <select name={f.key} multiple className={`${input} h-28`}>
          {f.validation?.options?.map((o) => <option key={o}>{o}</option>)}
        </select>
      );
    case 'number':
    case 'currency':
      return <input name={f.key} type="number" step="any" required={required} className={input} />;
    case 'date':
      return <input name={f.key} type="date" required={required} className={input} />;
    case 'datetime':
      return <input name={f.key} type="datetime-local" required={required} className={input} />;
    default:
      return <input name={f.key} required={required} className={input} />;
  }
}

/** Generated form + list view — 100% derived from the published definition. */
export default async function RecordsPage(routeCtx: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ role?: string }>;
}) {
  const { key } = await routeCtx.params;
  const { role: roleParam } = await routeCtx.searchParams;
  const role = (ROLES as readonly string[]).includes(roleParam ?? '') ? roleParam! : 'tenant-admin';

  const ctx = await getTenantContext();
  if (!ctx) notFound();
  const db = postgres(ctx.dbUrl, { max: 1, onnotice: () => {} });
  try {
    const def = await getObject(db, key);
    if (!def) notFound();

    const records = await db<{ id: string; data: Record<string, unknown>; created_at: string }[]>`
      select id, data, created_at from custom_records
      where object_key = ${key} order by created_at desc limit 50`;

    const formFields = editableFields(def, role).filter((f) => f.type !== 'file' && f.type !== 'lookup');
    const cols = visibleFields(def, role)
      .filter((f) => f.type !== 'section' && f.type !== 'file')
      .slice(0, 6);
    const themeVars = (ctx.theme?.colors ?? {}) as React.CSSProperties;

    return (
      <main style={themeVars} className="relative min-h-svh">
        <div className="absolute inset-0 bg-grid pointer-events-none" aria-hidden="true" />
        <div className="relative max-w-[1600px] mx-auto px-6 md:px-12 py-16">
          <Link href={`/objects/${key}`} className="font-body text-xs tracking-widest3 text-brand uppercase">
            ← Builder
          </Link>
          <h1 className="font-display text-chalk leading-[0.92] mt-4 mb-2" style={{ fontSize: 'clamp(36px, 4.5vw, 64px)' }}>
            {def.label.toUpperCase()} · RECORDS
          </h1>
          <p className="font-heading italic text-mute-1 mb-8">
            Form and table are generated from definition v{def.version}. Viewing as role{' '}
            <span className="text-brand">{role}</span> — fields honor per-role visibility.{' '}
            {(ROLES as readonly string[])
              .filter((r) => r !== role)
              .map((r) => (
                <Link key={r} href={`/objects/${key}/records?role=${r}`} className="underline text-mute-2 mr-2">
                  view as {r}
                </Link>
              ))}
          </p>

          <form
            method="post"
            action={`/api/objects/${key}/records`}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 border border-line bg-surface p-6 mb-12"
          >
            <input type="hidden" name="_role" value={role} />
            {formFields.map((f) => (
              <label key={f.key} className="flex flex-col gap-1 font-body text-xs text-mute-2 uppercase tracking-widest">
                {f.label}
                {f.validation?.required ? ' *' : ''}
                <FieldInput f={f} />
              </label>
            ))}
            <div className="flex items-end">
              <button
                type="submit"
                className="px-8 py-3 bg-brand-gradient text-white font-display text-base tracking-widest uppercase shadow-brand"
              >
                Create record
              </button>
            </div>
          </form>

          <div className="border border-line overflow-x-auto">
            <table className="w-full font-body text-sm">
              <thead>
                <tr className="border-b border-line bg-surface text-left">
                  {cols.map((c) => (
                    <th key={c.key} className="px-5 py-3 font-body text-xs uppercase tracking-widest text-mute-2">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-5 py-3 font-body text-xs uppercase tracking-widest text-mute-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 && (
                  <tr>
                    <td colSpan={cols.length + 1} className="px-5 py-8 text-mute-3 font-heading italic">
                      No records yet.
                    </td>
                  </tr>
                )}
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-b-0 hover:bg-brand-50 transition-colors">
                    {cols.map((c) => (
                      <td key={c.key} className="px-5 py-3">
                        {Array.isArray(r.data[c.key])
                          ? (r.data[c.key] as string[]).join(', ')
                          : String(r.data[c.key] ?? '—')}
                      </td>
                    ))}
                    <td className="px-5 py-3 text-mute-2">{new Date(r.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    );
  } finally {
    await db.end({ timeout: 2 });
  }
}
