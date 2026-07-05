import { NextResponse, type NextRequest } from 'next/server';
import {
  computePayslip,
  deriveNoPayDays,
  type AttendanceDay,
  type LeaveSpan,
  type StatutoryRates,
  type TaxTable,
} from '@hr/payroll';
import { canUseModule } from '@hr/entitlements';
import { withTenantDb } from '../../../../lib/objects';

/**
 * Payroll run for a period (YYYY-MM). Statutory rates and the APIT table are
 * read from THIS tenant's seeded, versioned reference rows — never from code.
 * Re-running a draft period replaces its payslips (feature sheet: Payroll
 * Re-Run); approved/locked runs are immutable.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const period = String(form.get('period') ?? '').trim();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    return NextResponse.json({ error: 'period must be YYYY-MM' }, { status: 400 });
  }
  const periodEnd = `${period}-28`; // rates effective by end of month

  const result = await withTenantDb(async (db, ctx) => {
    if (!canUseModule(ctx.entitlements, 'payroll')) {
      return { status: 403 as const, body: { error: 'payroll module not entitled' } };
    }

    const [existing] = await db<{ id: string; status: string }[]>`
      select id, status from payroll_runs where period = ${period}`;
    if (existing && existing.status !== 'draft') {
      return { status: 409 as const, body: { error: `run for ${period} is ${existing.status}` } };
    }

    // statutory parameters effective for the period (versioned, tenant-local)
    const rateRows = await db<{ kind: string; rate_percent: string }[]>`
      select kind, rate_percent from statutory_rates
      where effective_from <= ${periodEnd} and (effective_to is null or effective_to >= ${periodEnd})`;
    const rate = (k: string) => Number(rateRows.find((r) => r.kind === k)?.rate_percent);
    const rates: StatutoryRates = {
      epfEmployeePct: rate('epf_employee'),
      epfEmployerPct: rate('epf_employer'),
      etfEmployerPct: rate('etf_employer'),
    };
    const [taxRow] = await db<{ brackets: TaxTable['brackets'] }[]>`
      select brackets from tax_tables
      where name = 'APIT' and effective_from <= ${periodEnd}
        and (effective_to is null or effective_to >= ${periodEnd})
      order by effective_from desc limit 1`;
    if (!taxRow || Object.values(rates).some((v) => !Number.isFinite(v))) {
      return { status: 500 as const, body: { error: 'statutory reference data missing for period' } };
    }

    const employees = await db<
      { id: string; full_name: string; basic_salary: string; fixed_allowances: Record<string, number> }[]
    >`select id, full_name, basic_salary, fixed_allowances from employees where status = 'active'`;
    if (employees.length === 0) {
      return { status: 400 as const, body: { error: 'no active employees' } };
    }

    const [run] = existing
      ? [existing]
      : await db<{ id: string }[]>`
          insert into payroll_runs (period, status) values (${period}, 'draft') returning id`;
    await db`delete from payslips where run_id = ${run!.id}`;

    let totalGross = 0, totalNet = 0, totalStatutory = 0;
    for (const emp of employees) {
      const attendance = await db<AttendanceDay[]>`
        select to_char(day, 'YYYY-MM-DD') as day, status from attendance_records
        where employee_id = ${emp.id} and to_char(day, 'YYYY-MM') = ${period}`;
      const leaves = await db<LeaveSpan[]>`
        select leave_type as "leaveType", status,
               to_char(start_date, 'YYYY-MM-DD') as "startDate",
               to_char(end_date, 'YYYY-MM-DD') as "endDate"
        from leave_requests
        where employee_id = ${emp.id}
          and start_date <= ${periodEnd}::date + interval '3 days'
          and end_date >= ${period + '-01'}`;

      const noPayDays = deriveNoPayDays(period, attendance, leaves);

      // Financial wellness coupling: recover active advance/loan installments
      // post-tax (never touching the statutory base), capped at outstanding.
      const activeAdvances = await db<
        { id: string; kind: string; monthly_installment: string; outstanding: string }[]
      >`select id, kind, monthly_installment, outstanding from advances
        where employee_id = ${emp.id} and status = 'active' and outstanding > 0`;
      const postTaxDeductions: Record<string, number> = {};
      const recoveries: Array<{ id: string; amount: number }> = [];
      for (const a of activeAdvances) {
        const amount = Math.min(Number(a.monthly_installment), Number(a.outstanding));
        if (amount <= 0) continue;
        postTaxDeductions[`${a.kind}-recovery`] =
          (postTaxDeductions[`${a.kind}-recovery`] ?? 0) + amount;
        recoveries.push({ id: a.id, amount });
      }

      const slip = computePayslip({
        basic: Number(emp.basic_salary),
        fixedAllowances: emp.fixed_allowances ?? {},
        noPayDays,
        rates,
        tax: { brackets: taxRow.brackets },
        postTaxDeductions,
      });

      await db`insert into payslips
        (run_id, employee_id, basic, allowances, gross, no_pay_days, no_pay_deduction,
         epf_employee, epf_employer, etf_employer, apit, net, detail)
        values (${run!.id}, ${emp.id}, ${slip.basic}, ${db.json(emp.fixed_allowances ?? {})},
                ${slip.gross}, ${noPayDays}, ${slip.noPayDeduction},
                ${slip.epfEmployee}, ${slip.epfEmployer}, ${slip.etfEmployer},
                ${slip.apit}, ${slip.net},
                ${db.json({ employerCost: slip.employerCost, postTaxDeductions, recoveries } as never)})`;
      // NOTE: outstanding balances are reduced at run APPROVAL (recovery is
      // final only then) — so draft re-runs never double-deduct.
      totalGross += slip.gross;
      totalNet += slip.net;
      totalStatutory += slip.epfEmployee + slip.epfEmployer + slip.etfEmployer + slip.apit;
    }

    const totals = {
      employees: employees.length,
      gross: Math.round(totalGross * 100) / 100,
      net: Math.round(totalNet * 100) / 100,
      statutoryLiability: Math.round(totalStatutory * 100) / 100,
    };
    await db`update payroll_runs set totals = ${db.json(totals as never)} where id = ${run!.id}`;
    await db`insert into audit_log (action, object_key, record_id, detail)
      values ('payroll.run_computed', 'payroll-run', ${run!.id}, ${db.json(totals as never)})`;
    return { status: 201 as const, body: { runId: run!.id, period, ...totals } };
  });

  if (!result) return NextResponse.json({ error: 'no tenant context' }, { status: 404 });
  if (result.status === 201 && request.headers.get('accept')?.includes('text/html')) {
    return NextResponse.redirect(new URL('/payroll', request.url), 303);
  }
  return NextResponse.json(result.body, { status: result.status });
}
