import { NextResponse, type NextRequest } from 'next/server';
import type { FieldDefinition, FieldType } from '@hr/schema-engine';
import { FIELD_TYPES } from '@hr/schema-engine';
import { getObject, saveObjectVersion, slugifyKey, withTenantDb } from '../../../../../lib/objects';

/**
 * Wizard field operations — every change publishes a NEW definition version.
 *   op=add    label, type, required?, options?, sectionKey?, visibleToRoles?
 *   op=remove fieldKey
 */
export async function POST(
  request: NextRequest,
  routeCtx: { params: Promise<{ key: string }> },
) {
  const { key } = await routeCtx.params;
  const form = await request.formData();
  const op = String(form.get('op') ?? 'add');

  const result = await withTenantDb(async (db, ctx) => {
    const def = await getObject(db, key);
    if (!def) return { ok: false as const, error: 'object not found' };

    if (op === 'remove') {
      const fieldKey = String(form.get('fieldKey') ?? '');
      const before = def.fields.length;
      def.fields = def.fields.filter((f) => f.key !== fieldKey);
      if (def.fields.length === before) return { ok: false as const, error: 'field not found' };
    } else {
      const label = String(form.get('label') ?? '').trim();
      const type = String(form.get('type') ?? 'text') as FieldType;
      if (!label) return { ok: false as const, error: 'field label required' };
      if (!FIELD_TYPES.includes(type)) return { ok: false as const, error: 'invalid field type' };
      const options = String(form.get('options') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const visibleToRoles = String(form.get('visibleToRoles') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const field: FieldDefinition = {
        key: slugifyKey(label).replace(/-/g, '_'),
        label,
        type,
        displayOrder: def.fields.length + 1,
        sectionKey: String(form.get('sectionKey') ?? '') || def.sections[0]?.key,
        validation: {
          required: form.get('required') === 'on',
          ...(options.length && (type === 'singleSelect' || type === 'multiSelect')
            ? { options }
            : {}),
        },
        ...(visibleToRoles.length ? { visibleToRoles } : {}),
      };
      if (def.fields.some((f) => f.key === field.key)) {
        return { ok: false as const, error: 'field key already exists' };
      }
      def.fields.push(field);
    }
    return saveObjectVersion(db, ctx, def, 'wizard');
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  if (request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL(`/objects/${key}`, request.url), 303);
  }
  return NextResponse.json({ key, version: result.version });
}
