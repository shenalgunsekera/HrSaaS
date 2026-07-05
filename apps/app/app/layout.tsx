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
    if (canUseModule(ctx.entitlements, 'employee-master')) items.push({ href: '/employees', label: 'Employees' });
    if (canUseModule(ctx.entitlements, 'attendance')) items.push({ href: '/attendance', label: 'Attendance' });
    if (canUseModule(ctx.entitlements, 'leave')) items.push({ href: '/leave', label: 'Leave' });
    if (canUseModule(ctx.entitlements, 'payroll')) items.push({ href: '/payroll', label: 'Payroll' });
    if (canUseModule(ctx.entitlements, 'data-privacy')) items.push({ href: '/privacy', label: 'Privacy' });
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
        {ctx && (
          <header className="border-b border-line print:hidden">
            <div className="max-w-[1600px] mx-auto px-6 md:px-12 py-4 flex flex-wrap items-center gap-6">
              <Link href="/" className="flex items-center gap-3">
                {ctx.theme?.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ctx.theme.logoUrl}
                    alt=""
                    className="h-8 w-8 object-contain border border-line bg-ink p-0.5"
                  />
                )}
                <span className="font-display text-xl tracking-wide text-chalk">
                  {displayName?.toUpperCase()}
                </span>
                <span className="font-body text-[10px] tracking-widest2 uppercase text-mute-3 border border-line px-2 py-0.5">
                  {ctx.tier}
                </span>
              </Link>
              <div className="ml-auto">
                <TenantNav items={items} />
              </div>
            </div>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
