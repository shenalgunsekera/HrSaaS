/**
 * Sri Lanka payroll engine (Phase 6) — PURE functions. Every statutory
 * parameter is injected from the tenant's `statutory_rates` / `tax_tables`
 * rows effective for the period; nothing is hardcoded (docs/STATUTORY.md).
 *
 * Leave ↔ Attendance ↔ Payroll integrate through ONE surface:
 * `deriveNoPayDays` — the single definition of an unpaid day.
 */

export interface StatutoryRates {
  epfEmployeePct: number; // 8
  epfEmployerPct: number; // 12
  etfEmployerPct: number; // 3
}

/** Monthly APIT brackets: ordered, `upTo` = monthly income ceiling, null = top. */
export interface TaxTable {
  brackets: Array<{ upTo: number | null; ratePercent: number }>;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Progressive monthly APIT on total monthly remuneration. */
export function computeApitMonthly(monthlyRemuneration: number, tax: TaxTable): number {
  let apit = 0;
  let prev = 0;
  for (const b of tax.brackets) {
    const ceil = b.upTo ?? Infinity;
    if (monthlyRemuneration > prev) {
      const span = Math.min(monthlyRemuneration, ceil) - prev;
      apit += (span * b.ratePercent) / 100;
    }
    prev = ceil;
    if (monthlyRemuneration <= ceil) break;
  }
  return r2(apit);
}

export interface AttendanceDay {
  day: string; // YYYY-MM-DD
  status: 'present' | 'absent' | 'late' | 'half-day' | 'leave';
}

export interface LeaveSpan {
  leaveType: string;
  status: string;
  startDate: string;
  endDate: string;
}

/**
 * The Leave↔Attendance↔Payroll coupling. An unpaid day for a period is:
 *  - an APPROVED 'no-pay' leave day falling inside the period, or
 *  - an 'absent' attendance day NOT covered by any approved leave;
 *  - a 'half-day' attendance day counts 0.5 unless covered by approved leave.
 * Each calendar day is counted at most once.
 */
export function deriveNoPayDays(
  period: string, // YYYY-MM
  attendance: AttendanceDay[],
  leaves: LeaveSpan[],
): number {
  const inPeriod = (d: string) => d.startsWith(period);
  const approved = leaves.filter((l) => l.status === 'approved');
  const coveredByLeave = (d: string) =>
    approved.some((l) => d >= l.startDate && d <= l.endDate);
  const noPayLeaveDates = new Set<string>();
  for (const l of approved.filter((l) => l.leaveType === 'no-pay')) {
    const start = new Date(`${l.startDate}T00:00:00Z`);
    const end = new Date(`${l.endDate}T00:00:00Z`);
    for (let d = start; d <= end; d = new Date(d.getTime() + 86400000)) {
      const iso = d.toISOString().slice(0, 10);
      if (inPeriod(iso)) noPayLeaveDates.add(iso);
    }
  }
  let days = noPayLeaveDates.size;
  for (const a of attendance) {
    if (!inPeriod(a.day) || noPayLeaveDates.has(a.day)) continue;
    if (a.status === 'absent' && !coveredByLeave(a.day)) days += 1;
    else if (a.status === 'half-day' && !coveredByLeave(a.day)) days += 0.5;
  }
  return days;
}

export interface PayslipInput {
  basic: number;
  /** name → monthly amount; EPF/ETF/APIT base includes these (total earnings). */
  fixedAllowances: Record<string, number>;
  noPayDays: number;
  rates: StatutoryRates;
  tax: TaxTable;
  /** Divisor for a day's pay — SL convention 30. */
  noPayDivisor?: number;
}

export interface PayslipResult {
  basic: number;
  allowancesTotal: number;
  gross: number;
  noPayDeduction: number;
  epfEmployee: number;
  epfEmployer: number;
  etfEmployer: number;
  apit: number;
  totalDeductions: number;
  net: number;
  employerCost: number;
}

/**
 * One employee, one month. Order of operations:
 * gross = basic + fixed allowances; no-pay reduces gross earnings BEFORE
 * statutory bases (EPF/ETF/APIT apply to actual earnings for the month).
 */
export function computePayslip(input: PayslipInput): PayslipResult {
  const divisor = input.noPayDivisor ?? 30;
  const allowancesTotal = r2(Object.values(input.fixedAllowances).reduce((a, b) => a + b, 0));
  const grossBeforeNoPay = r2(input.basic + allowancesTotal);
  const noPayDeduction = r2((grossBeforeNoPay / divisor) * input.noPayDays);
  const earnings = r2(Math.max(0, grossBeforeNoPay - noPayDeduction));

  const epfEmployee = r2((earnings * input.rates.epfEmployeePct) / 100);
  const epfEmployer = r2((earnings * input.rates.epfEmployerPct) / 100);
  const etfEmployer = r2((earnings * input.rates.etfEmployerPct) / 100);
  const apit = computeApitMonthly(earnings, input.tax);

  const totalDeductions = r2(epfEmployee + apit);
  return {
    basic: input.basic,
    allowancesTotal,
    gross: earnings,
    noPayDeduction,
    epfEmployee,
    epfEmployer,
    etfEmployer,
    apit,
    totalDeductions,
    net: r2(earnings - totalDeductions),
    employerCost: r2(earnings + epfEmployer + etfEmployer),
  };
}

/**
 * Gratuity liability (Payment of Gratuity Act 12/1983): ½ month's last basic
 * per completed year, once ≥ minServiceYears. Accrual reporting; payable at exit.
 */
export function computeGratuity(
  lastBasic: number,
  completedYears: number,
  params: { halfMonthPerYear: boolean; minServiceYears: number },
): number {
  if (completedYears < params.minServiceYears || !params.halfMonthPerYear) return 0;
  return r2((lastBasic / 2) * completedYears);
}
