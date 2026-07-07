import { canUseModule } from '@hr/entitlements';
import { getTenantContext } from '../../lib/tenant';
import { withTenantDb } from '../../lib/objects';
import { PrintButton } from '../../components/PrintButton';

export const dynamic = 'force-dynamic';
const fmt = (v: string | number | null | undefined) => (v == null ? '—' : Number(v).toLocaleString());

/**
 * HR Analytics (L4) — cross-module executive dashboard. Aggregates over every
 * lower-tier module; empty modules degrade to graceful zeros (§8.2 — a fresh
 * L4 tenant with no history shows empty analytics, not errors).
 */
export default async function AnalyticsPage() {
  const ctx = await getTenantContext();
  if (!ctx) return null;
  if (!canUseModule(ctx.entitlements, 'hr-analytics')) {
    return (
      <main className="min-h-svh flex items-center justify-center px-6">
        <p className="font-body text-sm text-mute-2 max-w-md text-center">
          HR Analytics is available from level L4. Your company runs {ctx.tier}.
        </p>
      </main>
    );
  }

  const a = await withTenantDb(async (db) => {
    const [row] = await db<
      [{
        headcount: number; new_90: number; exits_90: number; female: number; male: number;
        absent_30: number; attendance_30: number; on_leave: number; nopay_30: number;
        payroll_period: string | null; payroll_net: string | null; payroll_statutory: string | null;
        avg_rating: string | null; high_perf: number; open_vacancies: number; candidates: number;
        courses: number; certs_expiring: number; open_cases: number;
        headcount_start: number;
      }]
    >`select
        (select count(*) from employees where status='active')::int as headcount,
        (select count(*) from employees where date_joined >= current_date - 90)::int as new_90,
        (select count(*) from final_settlements where last_day >= current_date - 90)::int as exits_90,
        (select count(*) from employees where status='active' and lower(coalesce(custom->>'gender',''))='female')::int as female,
        (select count(*) from employees where status='active' and lower(coalesce(custom->>'gender',''))='male')::int as male,
        (select count(*) from attendance_records where status='absent' and day >= current_date - 30)::int as absent_30,
        (select count(*) from attendance_records where day >= current_date - 30)::int as attendance_30,
        (select count(*) from leave_requests where status='approved' and current_date between start_date and end_date)::int as on_leave,
        (select count(*) from leave_requests where leave_type='no-pay' and status='approved' and start_date >= current_date - 30)::int as nopay_30,
        (select period from payroll_runs order by period desc limit 1) as payroll_period,
        (select totals->>'net' from payroll_runs order by period desc limit 1) as payroll_net,
        (select totals->>'statutoryLiability' from payroll_runs order by period desc limit 1) as payroll_statutory,
        (select round(avg(final_rating),2)::text from performance_reviews where status='finalized') as avg_rating,
        (select count(*) from performance_reviews where status='finalized' and final_rating >= 4)::int as high_perf,
        (select count(*) from vacancies where status='open')::int as open_vacancies,
        (select count(*) from candidates where status not in ('hired','rejected'))::int as candidates,
        (select count(*) from courses)::int as courses,
        (select count(*) from enrollments where status='completed' and expires_at is not null and expires_at <= current_date + 60)::int as certs_expiring,
        (select count(*) from cases where status <> 'closed')::int as open_cases,
        (select count(*) from employees)::int as headcount_start`;
    return row;
  });

  const turnover = a && a.headcount > 0 ? Math.round((a.exits_90 / (a.headcount + a.exits_90)) * 100) : 0;
  const absenteeism = a && a.attendance_30 > 0 ? Math.round((a.absent_30 / a.attendance_30) * 100) : 0;
  const genderRatio = a && a.male + a.female > 0 ? Math.round((a.female / (a.male + a.female)) * 100) : null;

  // Composite HR health score (0–100): retention, attendance, performance,
  // compliance — a simple weighted blend, each sub-score capped 0–100.
  const retentionScore = 100 - Math.min(100, turnover * 3);
  const attendanceScore = 100 - Math.min(100, absenteeism * 4);
  const perfScore = a?.avg_rating ? Math.round((Number(a.avg_rating) / 5) * 100) : 60;
  const complianceScore = a && a.open_cases > 0 ? Math.max(40, 100 - a.open_cases * 10) : 100;
  const health = Math.round(0.35 * retentionScore + 0.25 * attendanceScore + 0.25 * perfScore + 0.15 * complianceScore);

  const Section = ({ title, cards }: { title: string; cards: { k: string; v: string; warn?: boolean }[] }) => (
    <div className="mb-8">
      <h2 className="text-xs font-semibold tracking-wider uppercase text-brand mb-3">{title}</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
        {cards.map((c) => (
          <div key={c.v} className="bg-ink px-6 py-5">
            <div className={`text-2xl font-bold ${c.warn ? 'text-amber-600' : 'text-brand'}`}>{c.k}</div>
            <div className="font-body text-xs text-mute-2 mt-1">{c.v}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <main className="relative min-h-svh">
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-10 py-10">
        <p className="font-body text-xs font-semibold tracking-wider text-brand uppercase mb-4">
          HR Analytics · {ctx.slug} · executive dashboard
        </p>
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-chalk">Analytics</h1>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right">
              <div className={`text-3xl font-bold ${health >= 70 ? 'text-brand' : health >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{health}</div>
              <div className="text-[10px] uppercase tracking-wider text-mute-3">HR health score</div>
            </div>
            <PrintButton />
          </div>
        </div>

        <Section title="Workforce" cards={[
          { k: fmt(a?.headcount), v: 'Active headcount' },
          { k: fmt(a?.new_90), v: 'New hires (90 days)' },
          { k: `${turnover}%`, v: 'Turnover (rolling 90d)', warn: turnover > 15 },
          { k: genderRatio === null ? '—' : `${genderRatio}%`, v: 'Female ratio' },
        ]} />

        <Section title="Attendance & Leave" cards={[
          { k: `${absenteeism}%`, v: 'Absenteeism (30 days)', warn: absenteeism > 5 },
          { k: fmt(a?.on_leave), v: 'On leave today' },
          { k: fmt(a?.nopay_30), v: 'No-pay leave (30 days)' },
          { k: fmt(a?.attendance_30), v: 'Attendance records (30d)' },
        ]} />

        <Section title="Payroll" cards={[
          { k: a?.payroll_period ?? '—', v: 'Latest payroll period' },
          { k: fmt(a?.payroll_net), v: 'Net paid (latest)' },
          { k: fmt(a?.payroll_statutory), v: 'Statutory liability (latest)' },
          { k: a?.headcount ? fmt(Math.round(Number(a?.payroll_net ?? 0) / a.headcount)) : '—', v: 'Net per head' },
        ]} />

        <Section title="Talent" cards={[
          { k: a?.avg_rating ?? '—', v: 'Avg performance rating' },
          { k: fmt(a?.high_perf), v: 'High performers (≥4)' },
          { k: fmt(a?.open_vacancies), v: 'Open vacancies' },
          { k: fmt(a?.candidates), v: 'Candidates in pipeline' },
        ]} />

        <Section title="Learning & Relations" cards={[
          { k: fmt(a?.courses), v: 'Courses in catalogue' },
          { k: fmt(a?.certs_expiring), v: 'Certs expiring ≤60d', warn: (a?.certs_expiring ?? 0) > 0 },
          { k: fmt(a?.open_cases), v: 'Open ER cases', warn: (a?.open_cases ?? 0) > 0 },
          { k: fmt(a?.exits_90), v: 'Exits (90 days)' },
        ]} />

        <p className="font-body text-xs text-mute-3 mt-4">
          Cross-module aggregation over this tenant&apos;s dedicated database. Modules with no
          history contribute zero — analytics fill in as lower-tier data accrues.
        </p>
      </div>
    </main>
  );
}
