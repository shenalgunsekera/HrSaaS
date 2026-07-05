import { NextResponse, type NextRequest } from 'next/server';
import { withTenantDb } from '../../../../../lib/objects';

/**
 * Bank transfer file (CSV) for a payroll run — bank-paid employees only.
 * Local bank format templates plug in later (Integrations module); CSV is
 * the universal baseline every SL bank portal accepts.
 */
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ runId: string }> },
) {
  const { runId } = await ctx.params;
  const result = await withTenantDb(async (db) => {
    const [run] = await db<{ period: string }[]>`
      select period from payroll_runs where id = ${runId}`;
    if (!run) return null;
    const rows = await db<
      { full_name: string; bank_name: string | null; bank_branch: string | null;
        account_number: string | null; net: string }[]
    >`select e.full_name, e.bank_name, e.bank_branch, e.account_number, p.net
      from payslips p join employees e on e.id = p.employee_id
      where p.run_id = ${runId} and e.payment_method = 'bank'
      order by e.employee_number`;
    const esc = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      'beneficiary_name,bank,branch,account_number,amount_lkr,reference',
      ...rows.map((r) =>
        [esc(r.full_name), esc(r.bank_name), esc(r.bank_branch), esc(r.account_number),
         Number(r.net).toFixed(2), esc(`SALARY ${run.period}`)].join(','),
      ),
    ].join('\r\n');
    return { csv, period: run.period };
  });

  if (!result) return NextResponse.json({ error: 'run not found' }, { status: 404 });
  return new NextResponse(result.csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bank-transfer-${result.period}.csv"`,
    },
  });
}
