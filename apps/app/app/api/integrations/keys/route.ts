import { createHash, randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { withTenantDb } from '../../../../lib/objects';

/**
 * Create an API key. The secret is returned ONCE; only its SHA-256 lands in
 * the tenant DB. Format: hrk_<prefix>_<secret>.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const name = String(form.get('name') ?? '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const prefix = randomBytes(4).toString('hex');
  const secret = randomBytes(24).toString('base64url');
  const key = `hrk_${prefix}_${secret}`;
  const keyHash = createHash('sha256').update(key).digest('hex');

  const result = await withTenantDb(async (db) => {
    await db`insert into api_keys (name, prefix, key_hash) values (${name}, ${prefix}, ${keyHash})`;
    await db`insert into audit_log (action, object_key, detail)
      values ('api-key.created', 'api-key', ${db.json({ name, prefix })})`;
    return { ok: true };
  });
  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });

  if (request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL(`/integrations?key=${encodeURIComponent(key)}`, request.url), 303);
  }
  return NextResponse.json({ key, prefix, note: 'store this now — it is never shown again' }, { status: 201 });
}
