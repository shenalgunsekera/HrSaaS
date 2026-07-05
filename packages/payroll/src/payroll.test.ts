import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeApitMonthly,
  computeGratuity,
  computePayslip,
  deriveNoPayDays,
  type TaxTable,
} from './index';

/** IRD APIT Y/A 2025/26 monthly boundaries (docs/STATUTORY.md). */
const TAX: TaxTable = {
  brackets: [
    { upTo: 150000, ratePercent: 0 },
    { upTo: 233333.33, ratePercent: 6 },
    { upTo: 275000, ratePercent: 18 },
    { upTo: 316666.67, ratePercent: 24 },
    { upTo: 358333.33, ratePercent: 30 },
    { upTo: null, ratePercent: 36 },
  ],
};
const RATES = { epfEmployeePct: 8, epfEmployerPct: 12, etfEmployerPct: 3 };

describe('APIT monthly (hand-checked against IRD 2025/26 tables)', () => {
  it('at or below relief → zero', () => {
    assert.equal(computeApitMonthly(100000, TAX), 0);
    assert.equal(computeApitMonthly(150000, TAX), 0);
  });
  it('200,000 → 6% of 50,000 = 3,000', () => {
    assert.equal(computeApitMonthly(200000, TAX), 3000);
  });
  it('250,000 → 5,000 + 18% of 16,666.67 = 8,000', () => {
    assert.equal(computeApitMonthly(250000, TAX), 8000);
  });
  it('400,000 → 5,000+7,500+10,000+12,500+36% of 41,666.67 = 50,000', () => {
    assert.equal(computeApitMonthly(400000, TAX), 50000);
  });
});

describe('no-pay coupling (single integration surface)', () => {
  const period = '2026-06';
  it('approved no-pay leave days count', () => {
    assert.equal(
      deriveNoPayDays(period, [], [
        { leaveType: 'no-pay', status: 'approved', startDate: '2026-06-10', endDate: '2026-06-12' },
      ]),
      3,
    );
  });
  it('pending no-pay leave does NOT count', () => {
    assert.equal(
      deriveNoPayDays(period, [], [
        { leaveType: 'no-pay', status: 'pending', startDate: '2026-06-10', endDate: '2026-06-12' },
      ]),
      0,
    );
  });
  it('absence covered by approved annual leave does NOT count', () => {
    assert.equal(
      deriveNoPayDays(period, [{ day: '2026-06-15', status: 'absent' }], [
        { leaveType: 'annual', status: 'approved', startDate: '2026-06-15', endDate: '2026-06-15' },
      ]),
      0,
    );
  });
  it('uncovered absence counts; half-day counts 0.5; never double-counted', () => {
    assert.equal(
      deriveNoPayDays(
        period,
        [
          { day: '2026-06-15', status: 'absent' },
          { day: '2026-06-16', status: 'half-day' },
          { day: '2026-06-10', status: 'absent' }, // also a no-pay leave day
        ],
        [{ leaveType: 'no-pay', status: 'approved', startDate: '2026-06-10', endDate: '2026-06-10' }],
      ),
      2.5,
    );
  });
  it('days outside the period ignored', () => {
    assert.equal(
      deriveNoPayDays(period, [{ day: '2026-05-31', status: 'absent' }], [
        { leaveType: 'no-pay', status: 'approved', startDate: '2026-05-28', endDate: '2026-06-01' },
      ]),
      1,
    );
  });
});

describe('payslip (hand-checked)', () => {
  it('basic 180k + 40k allowances, 2 no-pay days, divisor 30', () => {
    const p = computePayslip({
      basic: 180000,
      fixedAllowances: { transport: 25000, meal: 15000 },
      noPayDays: 2,
      rates: RATES,
      tax: TAX,
    });
    // gross before no-pay 220,000; no-pay = 220,000/30*2 = 14,666.67
    assert.equal(p.noPayDeduction, 14666.67);
    assert.equal(p.gross, 205333.33); // earnings for the month
    assert.equal(p.epfEmployee, 16426.67); // 8%
    assert.equal(p.epfEmployer, 24640); // 12%
    assert.equal(p.etfEmployer, 6160); // 3%
    assert.equal(p.apit, 3320); // 6% of (205,333.33 - 150,000)
    assert.equal(p.net, 185586.66); // 205,333.33 - 16,426.67 - 3,320
    assert.equal(p.employerCost, 236133.33);
  });
  it('post-tax deductions reduce net only, never the statutory base', () => {
    const base = computePayslip({ basic: 200000, fixedAllowances: {}, noPayDays: 0, rates: RATES, tax: TAX });
    const withAdvance = computePayslip({
      basic: 200000, fixedAllowances: {}, noPayDays: 0, rates: RATES, tax: TAX,
      postTaxDeductions: { 'advance-recovery': 20000 },
    });
    assert.equal(withAdvance.epfEmployee, base.epfEmployee, 'EPF base unchanged');
    assert.equal(withAdvance.apit, base.apit, 'APIT base unchanged');
    assert.equal(withAdvance.net, base.net - 20000);
    assert.equal(withAdvance.postTaxDeductions, 20000);
  });

  it('below relief pays no APIT but full EPF', () => {
    const p = computePayslip({ basic: 120000, fixedAllowances: {}, noPayDays: 0, rates: RATES, tax: TAX });
    assert.equal(p.apit, 0);
    assert.equal(p.epfEmployee, 9600);
    assert.equal(p.net, 110400);
  });
});

describe('gratuity (Act 12/1983)', () => {
  it('below 5 years → nothing accrued', () => {
    assert.equal(computeGratuity(200000, 4, { halfMonthPerYear: true, minServiceYears: 5 }), 0);
  });
  it('7 completed years on 200k basic → 700,000', () => {
    assert.equal(computeGratuity(200000, 7, { halfMonthPerYear: true, minServiceYears: 5 }), 700000);
  });
});
