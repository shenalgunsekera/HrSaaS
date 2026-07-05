import { createHash } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { canUseModule } from '@hr/entitlements';
import { withTenantDb } from '../../../../lib/objects';

/**
 * Public REST API v1 — employees collection.
 * Auth: `Authorization: Bearer hrk_…` (tenant API key; SHA-256 verified,
 * revocation + last-used tracked). Entitlement gate: integrations module.
 * Rate limiting/usage metering layer on with the platform edge.
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization') ?? '';
  const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!key.startsWith('hrk_')) {
    return NextResponse.json({ error: 'missing bearer API key' }, { status: 401 });
  }
  const keyHash = createHash('sha256').update(key).digest('hex');

  const result = await withTenantDb(async (db, ctx) => {
    if (!canUseModule(ctx.entitlements, 'integrations')) {
      return { status: 403 as const, body: { error: 'integrations module not entitled' } };
    }
    const [k] = await db<{ id: string; revoked_at: string | null }[]>`
      select id, revoked_at from api_keys where key_hash = ${keyHash}`;
    if (!k || k.revoked_at) {
      return { status: 401 as const, body: { error: 'invalid or revoked API key' } };
    }
    await db`update api_keys set last_used_at = now() where id = ${k.id}`;

    const employees = await db`
      select employee_number, full_name, department, designation, status,
             to_char(date_joined,'YYYY-MM-DD') as date_joined
      from employees order by employee_number limit 200`;
    return { status: 200 as const, body: { data: employees, count: employees.length } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  return NextResponse.json(result.body, { status: result.status });
}
