import { NextResponse, type NextRequest } from 'next/server';
import { withTenantDb } from '../../../../../lib/objects';

/** Toggle a lifecycle checklist task. */
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const result = await withTenantDb(async (db) => {
    const [row] = await db<{ done: boolean }[]>`
      update lifecycle_tasks set done = not done, done_at = case when not done then now() end
      where id = ${id} returning done`;
    if (!row) return null;
    return { id, done: row.done };
  });
  if (!result) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/lifecycle', request.url), 303);
  }
  return NextResponse.json(result);
}
