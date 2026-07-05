import 'server-only';
import postgres from 'postgres';
import type { ObjectDefinition } from '@hr/schema-engine';
import { isProtectedCore } from '@hr/schema-engine';
import { canUseModule } from '@hr/entitlements';
import { getTenantContext } from './tenant';

/** Tenant-scoped schema-engine storage helpers (Phase 4). */

export async function withTenantDb<T>(
  fn: (db: ReturnType<typeof postgres>, ctx: NonNullable<Awaited<ReturnType<typeof getTenantContext>>>) => Promise<T>,
): Promise<T | null> {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  const db = postgres(ctx.dbUrl, { max: 1, onnotice: () => {} });
  try {
    return await fn(db, ctx);
  } finally {
    await db.end({ timeout: 2 });
  }
}

export async function listObjects(db: ReturnType<typeof postgres>) {
  const rows = await db<{ key: string; version: number; definition: ObjectDefinition }[]>`
    select distinct on (key) key, version, definition
    from object_definitions where status = 'published'
    order by key, version desc`;
  return rows.map((r) => ({ ...r.definition, key: r.key, version: r.version }));
}

export async function getObject(db: ReturnType<typeof postgres>, key: string) {
  const [row] = await db<{ version: number; definition: ObjectDefinition }[]>`
    select version, definition from object_definitions
    where key = ${key} and status = 'published'
    order by version desc limit 1`;
  if (!row) return null;
  return { ...row.definition, key, version: row.version };
}

/**
 * Persist a definition as a NEW version (definitions are immutable once
 * published — existing records keep their version). Guardrails enforced here:
 * protected cores are refused, and the object's module must be entitled.
 */
export async function saveObjectVersion(
  db: ReturnType<typeof postgres>,
  ctx: { entitlements: Parameters<typeof canUseModule>[0]; slug: string },
  def: ObjectDefinition,
  actor: string,
): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
  if (def.kind === 'custom' && isProtectedCore(def.key)) {
    return { ok: false, error: `'${def.key}' is a protected core object` };
  }
  if (!canUseModule(ctx.entitlements, def.moduleKey as never)) {
    return { ok: false, error: `module '${def.moduleKey}' is not entitled (or locked) for this company` };
  }
  const dupes = def.fields.map((f) => f.key);
  if (new Set(dupes).size !== dupes.length) {
    return { ok: false, error: 'duplicate field keys' };
  }
  const [prev] = await db<{ version: number }[]>`
    select version from object_definitions where key = ${def.key}
    order by version desc limit 1`;
  const version = (prev?.version ?? 0) + 1;
  await db`insert into object_definitions (key, version, status, definition)
    values (${def.key}, ${version}, 'published', ${db.json(JSON.parse(JSON.stringify({ ...def, version })) as never)})`;
  await db`insert into audit_log (action, object_key, detail)
    values ('schema.definition_published', ${def.key},
            ${db.json({ version, actor, fields: def.fields.length })})`;
  return { ok: true, version };
}

export function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
