import type { Metadata } from 'next';
import Link from 'next/link';
import { TenantThemeStyle } from '@hr/design-system';
import { canUseModule, type ModuleKey } from '@hr/entitlements';
import { getTenantContext } from '../lib/tenant';
import { TenantNav, type NavGroup, type NavItem } from '../components/TenantNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'HR Platform',
  description: 'Multi-tenant HR SaaS — tenant application',
};

/**
 * Navigation map: grouped sections, each item optionally gated by a module.
 * `always` items (Overview, Objects, Status) are ungated.
 */
interface NavSpec {
  label: string;
  items: Array<{ href: string; label: string; icon: string; module?: ModuleKey; always?: boolean }>;
}

const NAV: NavSpec[] = [
  {
    label: 'Overview',
    items: [{ href: '/', label: 'Home', icon: '◆', always: true }],
  },
  {
    label: 'People',
    items: [
      { href: '/employees', label: 'Employees', icon: '●', module: 'employee-master' },
      { href: '/lifecycle', label: 'Lifecycle', icon: '◐', module: 'employee-master' },
      { href: '/attendance', label: 'Attendance', icon: '◔', module: 'attendance' },
      { href: '/leave', label: 'Leave', icon: '◑', module: 'leave' },
      { href: '/payroll', label: 'Payroll', icon: '▦', module: 'payroll' },
    ],
  },
  {
    label: 'Workforce',
    items: [
      { href: '/contractors', label: 'Contractors', icon: '◇', module: 'contractor-gig' },
      { href: '/wellness', label: 'Wellness', icon: '♦', module: 'financial-wellness' },
      { href: '/privacy', label: 'Privacy', icon: '⚿', module: 'data-privacy' },
      { href: '/integrations', label: 'Integrations', icon: '⇄', module: 'integrations' },
    ],
  },
  {
    label: 'Talent',
    items: [
      { href: '/recruitment', label: 'Recruitment', icon: '◎', module: 'recruitment' },
      { href: '/performance', label: 'Performance', icon: '▲', module: 'performance' },
      { href: '/training', label: 'Training', icon: '◈', module: 'training' },
      { href: '/compensation', label: 'Compensation', icon: '▤', module: 'compensation' },
      { href: '/engagement', label: 'Engagement', icon: '☺', module: 'experience-engagement' },
    ],
  },
  {
    label: 'Organization',
    items: [
      { href: '/succession', label: 'Succession', icon: '⇡', module: 'succession' },
      { href: '/competency', label: 'Competency', icon: '◨', module: 'competency' },
      { href: '/skills', label: 'Skills', icon: '✦', module: 'skills-intelligence' },
      { href: '/workforce', label: 'Workforce Planning', icon: '▥', module: 'workforce-planning' },
      { href: '/entities', label: 'Multi-Entity Payroll', icon: '⬢', module: 'multi-entity-payroll' },
    ],
  },
  {
    label: 'Relations',
    items: [
      { href: '/cases', label: 'Disciplinary & Grievance', icon: '⚖', always: true },
    ],
  },
  {
    label: 'Build',
    items: [
      { href: '/objects', label: 'Objects', icon: '⬡', always: true },
      { href: '/status', label: 'Status', icon: '◉', always: true },
    ],
  },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getTenantContext();
  const displayName = (ctx as { displayName?: string } | null)?.displayName ?? ctx?.slug;

  const groups: NavGroup[] = ctx
    ? NAV.map((spec) => ({
        label: spec.label,
        items: spec.items
          .filter((it) => it.always || (it.module && canUseModule(ctx.entitlements, it.module)))
          .map<NavItem>((it) => ({ href: it.href, label: it.label, icon: it.icon })),
      }))
    : [];

  return (
    <html lang="en">
      <body
        className="bg-ink text-chalk font-body antialiased"
        style={(ctx?.theme?.colors ?? {}) as React.CSSProperties}
      >
        <TenantThemeStyle theme={ctx?.theme?.colors ?? null} />
        {ctx ? (
          <div className="md:flex min-h-svh">
            <aside className="md:w-60 md:shrink-0 md:min-h-svh md:sticky md:top-0 md:h-svh border-b md:border-b-0 md:border-r border-line bg-ink print:hidden flex md:flex-col gap-4 md:gap-0 items-center md:items-stretch px-4 md:px-0 py-3 md:py-0">
              <Link href="/" className="flex items-center gap-3 md:px-5 md:py-5 md:border-b md:border-line shrink-0">
                {ctx.theme?.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ctx.theme.logoUrl}
                    alt=""
                    className="h-9 w-9 object-contain rounded border border-line bg-ink p-0.5"
                  />
                )}
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-tight text-chalk truncate">
                    {displayName}
                  </span>
                  <span className="font-body text-[11px] text-mute-3">Tier {ctx.tier}</span>
                </span>
              </Link>
              <div className="md:py-4 md:flex-1 min-w-0 md:overflow-y-auto">
                <TenantNav groups={groups} />
              </div>
              <p className="hidden md:block px-5 py-3 border-t border-line font-body text-[10px] text-mute-3 leading-relaxed shrink-0">
                Dedicated database
                <br />
                <span className="text-mute-2">{ctx.dbRef}</span>
              </p>
            </aside>
            <div className="flex-1 min-w-0">{children}</div>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
