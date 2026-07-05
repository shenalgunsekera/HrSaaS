import { NextResponse, type NextRequest } from 'next/server';
import { canUseModule } from '@hr/entitlements';
import { DEFAULT_ROLE_DEFINITIONS, isAllowed, type Role } from '@hr/rbac';
import { ENTITIES } from '../../../../lib/entities';
import { withTenantDb } from '../../../../lib/objects';

/**
 * Generic whitelisted mutations completing CRUD for registered entities:
 *   op=update id, plus ONLY columns in the registry's `updatable` list
 *   op=delete id (only entities marked deletable; money/statutory never)
 * Both gates run (module entitlement + RBAC update/delete), all audited.
 */
export async function POST(
  request: NextRequest,
  ctx0: { params: Promise<{ entity: string }> },
) {
  const { entity } = await ctx0.params;
  const def = ENTITIES[entity];
  if (!def?.table) return NextResponse.json({ error: 'entity not mutable' }, { status: 404 });

  const form = await request.formData();
  const op = String(form.get('op') ?? '');
  const id = String(form.get('id') ?? '');
  const role = (String(form.get('_role') ?? 'hr') || 'hr') as Role;
  if (!id || !['update', 'delete'].includes(op)) {
    return NextResponse.json({ error: 'op update|delete and id required' }, { status: 400 });
  }
  if (
    !isAllowed(DEFAULT_ROLE_DEFINITIONS, {
      role,
      moduleKey: def.moduleKey,
      action: op === 'delete' ? 'delete' : 'update',
      targetScope: 'all',
    })
  ) {
    return NextResponse.json({ error: `role '${role}' may not ${op} ${entity}` }, { status: 403 });
  }

  const result = await withTenantDb(async (db, ctx) => {
    if (!canUseModule(ctx.entitlements, def.moduleKey as never)) {
      return { status: 403 as const, body: { error: `${def.moduleKey} module not entitled` } };
    }

    if (op === 'delete') {
      if (!def.deletable) return { status: 405 as const, body: { error: `${entity} records are never deleted (retention/statutory)` } };
      const rows = await db.unsafe(
        `delete from "${def.table}" where id = $1 returning id`,
        [id],
      );
      if (rows.length === 0) return { status: 404 as const, body: { error: 'not found' } };
      await db`insert into audit_log (action, object_key, record_id, detail)
        values ('record.deleted', ${entity}, ${id}, ${db.json({ role })})`;
      return { status: 200 as const, body: { id, deleted: true } };
    }

    // update: only whitelisted columns present in the form
    const updatable = def.updatable ?? [];
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const col of updatable) {
      const v = form.get(col);
      if (v === null) continue;
      values.push(col === 'mandatory' ? v === 'true' || v === 'on' : String(v));
      sets.push(`"${col}" = $${values.length}`);
    }
    if (sets.length === 0) {
      return { status: 400 as const, body: { error: `no updatable fields provided (allowed: ${updatable.join(', ') || 'none'})` } };
    }
    values.push(id);
    const rows = await db.unsafe(
      `update "${def.table}" set ${sets.join(', ')} where id = $${values.length} returning id`,
      values as never[],
    );
    if (rows.length === 0) return { status: 404 as const, body: { error: 'not found' } };
    await db`insert into audit_log (action, object_key, record_id, detail)
      values ('record.updated', ${entity}, ${id}, ${db.json({ role, fields: sets.length })})`;
    return { status: 200 as const, body: { id, updated: sets.length } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if (result.status === 200 && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL(request.headers.get('referer') ?? '/', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
