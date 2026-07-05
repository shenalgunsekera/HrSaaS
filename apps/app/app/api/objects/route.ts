import { NextResponse, type NextRequest } from 'next/server';
import type { ObjectDefinition } from '@hr/schema-engine';
import { employeeMasterTemplate } from '@hr/schema-engine';
import { saveObjectVersion, slugifyKey, withTenantDb } from '../../../lib/objects';

/** Create a custom object (optionally from a starter template). */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const label = String(form.get('label') ?? '').trim();
  const moduleKey = String(form.get('moduleKey') ?? '').trim();
  const icon = String(form.get('icon') ?? '').trim() || undefined;
  const template = String(form.get('template') ?? '');

  if (!label) return NextResponse.json({ error: 'label required' }, { status: 400 });
  if (!moduleKey) return NextResponse.json({ error: 'moduleKey required' }, { status: 400 });

  const key = slugifyKey(label);
  const def: ObjectDefinition =
    template === 'employee-master'
      ? { ...employeeMasterTemplate, key, label, moduleKey, kind: 'custom', extendsCore: undefined }
      : {
          key,
          label,
          icon,
          kind: 'custom',
          moduleKey,
          sections: [{ key: 'general', label: 'General', displayOrder: 1 }],
          fields: [],
          version: 0,
          status: 'published',
        };

  const result = await withTenantDb(async (db, ctx) => {
    const existing = await db`select 1 from object_definitions where key = ${key} limit 1`;
    if (existing.length > 0) return { ok: false as const, error: 'object already exists' };
    return saveObjectVersion(db, ctx, def, 'wizard');
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  if (request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL(`/objects/${key}`, request.url), 303);
  }
  return NextResponse.json({ key, version: result.version }, { status: 201 });
}
