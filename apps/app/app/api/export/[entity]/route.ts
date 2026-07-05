import { NextResponse, type NextRequest } from 'next/server';
import { canUseModule } from '@hr/entitlements';
import { ENTITIES, runEntityQuery, toCsv } from '../../../../lib/entities';
import { withTenantDb } from '../../../../lib/objects';

/** CSV export for any registered entity — entitlement-gated per module. */
export async function GET(
  _request: NextRequest,
  ctx0: { params: Promise<{ entity: string }> },
) {
  const { entity } = await ctx0.params;
  const def = ENTITIES[entity];
  if (!def) return NextResponse.json({ error: 'unknown entity' }, { status: 404 });

  const result = await withTenantDb(async (db, ctx) => {
    if (!canUseModule(ctx.entitlements, def.moduleKey as never)) {
      return { status: 403 as const, csv: null };
    }
    return { status: 200 as const, csv: toCsv(await runEntityQuery(db, def)) };
  });
  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if (result.status === 403) {
    return NextResponse.json({ error: `${def.moduleKey} module not entitled` }, { status: 403 });
  }
  return new NextResponse(result.csv ?? '', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${entity}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
