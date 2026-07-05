import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { withTenantDb } from '../../../../lib/objects';

/** Register a webhook endpoint; the signing secret is returned once. */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const url = String(form.get('url') ?? '').trim();
  const events = String(form.get('events') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: 'valid http(s) url required' }, { status: 400 });
  }

  const secret = randomBytes(24).toString('hex');
  const result = await withTenantDb(async (db) => {
    const [row] = await db<{ id: string }[]>`
      insert into webhooks (url, events, secret) values (${url}, ${db.json(events)}, ${secret})
      returning id`;
    await db`insert into audit_log (action, object_key, record_id, detail)
      values ('webhook.registered', 'webhook', ${row!.id}, ${db.json({ url, events })})`;
    return { id: row!.id };
  });
  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });

  if (request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL(`/integrations?whsecret=${secret}`, request.url), 303);
  }
  return NextResponse.json({ ...result, secret, note: 'store the secret now' }, { status: 201 });
}
