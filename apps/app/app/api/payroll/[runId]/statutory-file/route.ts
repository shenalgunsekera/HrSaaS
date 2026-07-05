import { NextResponse, type NextRequest } from 'next/server';
import { withTenantDb } from '../../../../../lib/objects';

/**
 * EPF/ETF/APIT statutory remittance file (CSV) for a payroll run — the
 * per-employee contribution register plus totals row. Formal e-filing
 * formats (EPF C-form / IRD schedules) layer on in the Integrations module.
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
      { employee_number: string; full_name: string; epf_number: string | null;
        gross: string; epf_employee: string; epf_employer: string;
        etf_employer: string; apit: string }[]
    >`select e.employee_number, e.full_name, e.epf_number, p.gross,
        p.epf_employee, p.epf_employer, p.etf_employer, p.apit
      from payslips p join employees e on e.id = p.employee_id
      where p.run_id = ${runId} order by e.employee_number`;
    const sum = (k: 'epf_employee' | 'epf_employer' | 'etf_employer' | 'apit' | 'gross') =>
      rows.reduce((a, r) => a + Number(r[k]), 0).toFixed(2);
    const esc = (v: string | null) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      'employee_number,name,epf_number,gross_earnings,epf_employee_8,epf_employer_12,etf_employer_3,apit',
      ...rows.map((r) =>
        [r.employee_number, esc(r.full_name), esc(r.epf_number), Number(r.gross).toFixed(2),
         Number(r.epf_employee).toFixed(2), Number(r.epf_employer).toFixed(2),
         Number(r.etf_employer).toFixed(2), Number(r.apit).toFixed(2)].join(','),
      ),
      `TOTAL,,,${sum('gross')},${sum('epf_employee')},${sum('epf_employer')},${sum('etf_employer')},${sum('apit')}`,
    ].join('\r\n');
    return { csv, period: run.period };
  });

  if (!result) return NextResponse.json({ error: 'run not found' }, { status: 404 });
  return new NextResponse(result.csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="statutory-${result.period}.csv"`,
    },
  });
}
