import type { Metadata } from 'next';
import Link from 'next/link';
import { TenantThemeStyle } from '@hr/design-system';
import { canUseModule } from '@hr/entitlements';
import { getTenantContext } from '../lib/tenant';
import { TenantNav, type NavItem } from '../components/TenantNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'HR Platform',
  description: 'Multi-tenant HR SaaS — tenant application',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getTenantContext();
  const displayName = (ctx as { displayName?: string } | null)?.displayName ?? ctx?.slug;

  const items: NavItem[] = [];
  if (ctx) {
    items.push({ href: '/', label: 'Overview' });
    if (canUseModule(ctx.entitlements, 'employee-master')) items.push({ href: '/employees', label: 'Employees' });
    if (canUseModule(ctx.entitlements, 'employee-master')) items.push({ href: '/lifecycle', label: 'Lifecycle' });
    if (canUseModule(ctx.entitlements, 'attendance')) items.push({ href: '/attendance', label: 'Attendance' });
    if (canUseModule(ctx.entitlements, 'leave')) items.push({ href: '/leave', label: 'Leave' });
    if (canUseModule(ctx.entitlements, 'payroll')) items.push({ href: '/payroll', label: 'Payroll' });
    if (canUseModule(ctx.entitlements, 'recruitment')) items.push({ href: '/recruitment', label: 'Recruitment' });
    if (canUseModule(ctx.entitlements, 'performance')) items.push({ href: '/performance', label: 'Performance' });
    if (canUseModule(ctx.entitlements, 'training')) items.push({ href: '/training', label: 'Training' });
    if (canUseModule(ctx.entitlements, 'contractor-gig')) items.push({ href: '/contractors', label: 'Contractors' });
    if (canUseModule(ctx.entitlements, 'financial-wellness')) items.push({ href: '/wellness', label: 'Wellness' });
    if (canUseModule(ctx.entitlements, 'data-privacy')) items.push({ href: '/privacy', label: 'Privacy' });
    if (canUseModule(ctx.entitlements, 'integrations')) items.push({ href: '/integrations', label: 'Integrations' });
    items.push({ href: '/objects', label: 'Objects' });
    items.push({ href: '/status', label: 'Status' });
  }

  return (
    <html lang="en">
      <body
        className="bg-ink text-chalk font-body antialiased"
        style={(ctx?.theme?.colors ?? {}) as React.CSSProperties}
      >
        <TenantThemeStyle theme={ctx?.theme?.colors ?? null} />
        {ctx ? (
          <div className="md:flex min-h-svh">
            {/* sidebar */}
            <aside className="md:w-60 md:shrink-0 md:min-h-svh md:sticky md:top-0 md:h-svh border-b md:border-b-0 md:border-r border-line print:hidden flex md:flex-col gap-4 md:gap-0 items-center md:items-stretch px-4 md:px-0 py-3 md:py-0">
              <Link href="/" className="flex items-center gap-3 md:px-5 md:py-6 md:border-b md:border-line">
                {ctx.theme?.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ctx.theme.logoUrl}
                    alt=""
                    className="h-9 w-9 object-contain border border-line bg-ink p-0.5"
                  />
                )}
                <span className="min-w-0">
                  <span className="block text-sm font-bold leading-tight text-chalk truncate">
                    {displayName}
                  </span>
                  <span className="font-body text-[11px] text-mute-3">Tier {ctx.tier}</span>
                </span>
              </Link>
              <div className="md:py-4 md:flex-1 min-w-0">
                <TenantNav items={items} />
              </div>
              <p className="hidden md:block px-5 py-4 border-t border-line font-body text-[10px] text-mute-3 leading-relaxed">
                Dedicated database
                <br />
                <span className="text-mute-2">{ctx.dbRef}</span>
              </p>
            </aside>
            {/* content */}
            <div className="flex-1 min-w-0">{children}</div>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
