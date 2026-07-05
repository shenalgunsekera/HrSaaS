import Link from 'next/link';
import { Reveal, SectionHeading } from '@hr/design-system';
import { getTenantContext } from '../lib/tenant';
import { withTenantDb } from '../lib/objects';

export const dynamic = 'force-dynamic';

const fmt = (v: string | number | null | undefined) =>
  v == null ? '—' : Number(v).toLocaleString();

/** Tenant home: L1 overview dashboard (feature-sheet dashboard items). */
export default async function Home() {
  const ctx = await getTenantContext();

  if (!ctx) {
    return (
      <main className="relative min-h-svh flex items-center border-b border-line overflow-hidden">
        <div className="absolute inset-0 bg-brand-radial pointer-events-none" aria-hidden="true" />
        <div className="relative w-full max-w-[1600px] mx-auto px-6 md:px-12 py-24">
          <SectionHeading
            kicker="HR Platform"
            title={
              <>
                ONE CODEBASE.
                <br />
                <span className="bg-brand-gradient bg-clip-text text-transparent">
                  EVERY COMPANY ITS OWN WORLD.
                </span>
              </>
            }
            standfirst="No tenant resolved for this host — unknown, inactive, or unprovisioned."
          />
        </div>
      </main>
    );
  }

  const stats = await withTenantDb(async (db) => {
    const [s] = await db<
      [{
        active_employees: string; present_today: string; absent_today: string;
        pending_leave: string; on_leave_today: string; open_dsrs: string;
        latest_period: string | null; latest_net: string | null; latest_status: string | null;
        custom_objects: string; new_this_month: string;
      }]
    >`select
        (select count(*) from employees where status = 'active')::text as active_employees,
        (select count(*) from attendance_records where day = current_date and status in ('present','late'))::text as present_today,
        (select count(*) from attendance_records where day = current_date and status = 'absent')::text as absent_today,
        (select count(*) from leave_requests where status = 'pending')::text as pending_leave,
        (select count(*) from leave_requests where status = 'approved'
           and current_date between start_date and end_date)::text as on_leave_today,
        (select count(*) from data_subject_requests where status = 'open')::text as open_dsrs,
        (select period from payroll_runs order by period desc limit 1) as latest_period,
        (select totals->>'net' from payroll_runs order by period desc limit 1) as latest_net,
        (select status from payroll_runs order by period desc limit 1) as latest_status,
        (select count(distinct key) from object_definitions where status = 'published')::text as custom_objects,
        (select count(*) from employees where date_joined >= date_trunc('month', current_date))::text as new_this_month`;
    return s;
  });
  const displayName = (ctx as { displayName?: string }).displayName ?? ctx.slug;

  const cards = [
    { k: stats?.active_employees ?? '0', v: 'Active employees', href: '/employees' },
    { k: stats?.new_this_month ?? '0', v: 'Joined this month', href: '/employees' },
    { k: stats?.present_today ?? '0', v: 'Present today', href: '/attendance' },
    { k: stats?.absent_today ?? '0', v: 'Absent today', href: '/attendance' },
    { k: stats?.on_leave_today ?? '0', v: 'On leave today', href: '/leave' },
    { k: stats?.pending_leave ?? '0', v: 'Pending leave approvals', href: '/leave' },
    { k: stats?.open_dsrs ?? '0', v: 'Open data-subject requests', href: '/privacy' },
    { k: stats?.custom_objects ?? '0', v: 'Custom objects defined', href: '/objects' },
  ];

  return (
    <main className="relative min-h-svh overflow-hidden">
      <div className="absolute inset-0 bg-brand-radial pointer-events-none" aria-hidden="true" />
      <div className="relative max-w-[1600px] mx-auto px-6 md:px-12 py-16">
        <Reveal>
          <p className="font-body text-xs tracking-widest3 text-brand uppercase mb-4">
            Overview · {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="font-display text-chalk leading-[0.92] mb-12" style={{ fontSize: 'clamp(44px, 6vw, 88px)' }}>
            GOOD DAY,
            <br />
            <span className="bg-brand-gradient bg-clip-text text-transparent">
              {displayName.toUpperCase()}
            </span>
          </h1>
        </Reveal>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
          {cards.map((c, i) => (
            <Reveal key={c.v} delay={0.12 + i * 0.04} y={14} className="bg-ink">
              <Link href={c.href} className="block px-7 py-6 hover:bg-brand-50 transition-colors duration-300 h-full">
                <div className="font-display text-4xl md:text-5xl text-brand">{c.k}</div>
                <div className="font-body text-sm text-mute-2 mt-1.5">{c.v}</div>
              </Link>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.4}>
          <Link
            href="/payroll"
            className="mt-10 flex flex-wrap items-baseline gap-4 border border-line bg-surface px-7 py-6 hover:bg-brand-50 transition-colors"
          >
            <span className="font-body text-xs tracking-widest3 text-brand uppercase">
              Latest payroll
            </span>
            {stats?.latest_period ? (
              <>
                <span className="font-display text-3xl text-chalk">{stats.latest_period}</span>
                <span className="font-body text-sm text-mute-2">
                  net LKR {fmt(stats.latest_net)} · {stats.latest_status}
                </span>
              </>
            ) : (
              <span className="font-heading italic text-mute-3">No runs yet — run your first payroll →</span>
            )}
          </Link>
        </Reveal>
      </div>
    </main>
  );
}
