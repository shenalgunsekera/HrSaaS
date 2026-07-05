import { NextResponse, type NextRequest } from 'next/server';
import { editableFields, validateRecord } from '@hr/schema-engine';
import { DEFAULT_ROLE_DEFINITIONS, isAllowed, type Role } from '@hr/rbac';
import { getObject, withTenantDb } from '../../../../../lib/objects';

/**
 * Create a record for a metadata-defined object. Both gates run:
 * entitlement was checked when the definition was saved and is re-checked on
 * read; RBAC here per acting role. Until per-tenant auth lands, the acting
 * role is supplied by the form (documented simulation, server-enforced).
 */
export async function POST(
  request: NextRequest,
  routeCtx: { params: Promise<{ key: string }> },
) {
  const { key } = await routeCtx.params;
  const form = await request.formData();
  const role = (String(form.get('_role') ?? 'employee') || 'employee') as Role;

  const result = await withTenantDb(async (db, ctx) => {
    const def = await getObject(db, key);
    if (!def) return { status: 404 as const, body: { error: 'object not found' } };

    // gate 2: RBAC — may this role create records in this module?
    if (
      !isAllowed(DEFAULT_ROLE_DEFINITIONS, {
        role,
        moduleKey: def.moduleKey,
        action: 'create',
        targetScope: 'self',
      })
    ) {
      return { status: 403 as const, body: { error: `role '${role}' may not create ${def.label} records` } };
    }

    // field-level: only fields this role may edit are accepted
    const allowed = editableFields(def, role);
    const data: Record<string, unknown> = {};
    for (const f of allowed) {
      const raw = form.getAll(f.key);
      if (raw.length === 0) continue;
      const value = f.type === 'multiSelect' ? raw.map(String) : String(raw[0]);
      if (value !== '' && !(Array.isArray(value) && value.length === 0)) data[f.key] = value;
    }
    // reject values for fields outside the role's edit set
    const allowedKeys = new Set(allowed.map((f) => f.key));
    for (const [k] of form.entries()) {
      if (k.startsWith('_')) continue;
      if (!allowedKeys.has(k) && def.fields.some((f) => f.key === k)) {
        return {
          status: 403 as const,
          body: { error: `role '${role}' may not set field '${k}'` },
        };
      }
    }

    const issues = validateRecord(
      { ...def, fields: def.fields.filter((f) => allowedKeys.has(f.key)) },
      data,
    );
    if (issues.length > 0) {
      return { status: 422 as const, body: { error: 'validation failed', issues } };
    }

    const [row] = await db<{ id: string }[]>`
      insert into custom_records (object_key, definition_version, data)
      values (${key}, ${def.version}, ${db.json(data as never)})
      returning id`;
    await db`insert into audit_log (action, object_key, record_id, detail)
      values ('record.created', ${key}, ${row!.id}, ${db.json({ role, tenant: ctx.slug })})`;
    return { status: 201 as const, body: { id: row!.id } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if (result.status === 201 && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL(`/objects/${key}/records`, request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
