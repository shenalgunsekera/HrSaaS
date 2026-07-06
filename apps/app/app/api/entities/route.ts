import { NextResponse, type NextRequest } from 'next/server';
import { canUseModule } from '@hr/entitlements';
import { withTenantDb } from '../../../lib/objects';

/**
 * Multi-Entity Payroll (L3-gated):
 *  op=entity  name, country, currency
 *  op=assign  entityName, employeeNumber
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const op = String(form.get('op') ?? '');

  const result = await withTenantDb(async (db, ctx) => {
    if (!canUseModule(ctx.entitlements, 'multi-entity-payroll')) {
      return { status: 403 as const, body: { error: 'multi-entity payroll module not entitled for this company' } };
    }

    if (op === 'entity') {
      const name = String(form.get('name') ?? '').trim();
      const country = String(form.get('country') ?? 'LK').trim().toUpperCase().slice(0, 2);
      const currency = String(form.get('currency') ?? 'LKR').trim().toUpperCase().slice(0, 3);
      if (!name) return { status: 400 as const, body: { error: 'name required' } };
      try {
        const [row] = await db<{ id: string }[]>`
          insert into legal_entities (name, country, currency)
          values (${name}, ${country}, ${currency}) returning id`;
        return { status: 201 as const, body: { id: row!.id } };
      } catch {
        return { status: 409 as const, body: { error: 'entity already exists' } };
      }
    }

    if (op === 'assign') {
      const entityName = String(form.get('entityName') ?? '').trim();
      const employeeNumber = String(form.get('employeeNumber') ?? '').trim();
      const [ent] = await db<{ id: string }[]>`select id from legal_entities where name = ${entityName}`;
      if (!ent) return { status: 404 as const, body: { error: 'entity not found' } };
      const [emp] = await db<{ id: string }[]>`
        update employees set entity_id = ${ent.id}, updated_at = now()
        where employee_number = ${employeeNumber} returning id`;
      if (!emp) return { status: 404 as const, body: { error: 'employee not found' } };
      return { status: 200 as const, body: { employeeNumber, entity: entityName } };
    }

    return { status: 400 as const, body: { error: 'unknown op' } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if ((result.status === 200 || result.status === 201) && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/entities', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
