import { NextResponse, type NextRequest } from 'next/server';
import { withTenantDb } from '../../../../../../lib/objects';

/** Revoke an API key immediately. */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const result = await withTenantDb(async (db) => {
    const [row] = await db<{ id: string }[]>`
      update api_keys set revoked_at = now() where id = ${id} and revoked_at is null
      returning id`;
    if (!row) return { status: 404 as const, body: { error: 'not found or already revoked' } };
    await db`insert into audit_log (action, object_key, record_id)
      values ('api-key.revoked', 'api-key', ${id})`;
    return { status: 200 as const, body: { id, revoked: true } };
  });
  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if (result.status === 200 && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/integrations', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
