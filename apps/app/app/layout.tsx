import type { Metadata } from 'next';
import { TenantThemeStyle } from '@hr/design-system';
import './globals.css';

export const metadata: Metadata = {
  title: 'HR Platform',
  description: 'Multi-tenant HR SaaS — tenant application',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Phase 3: load the tenant's theme from request context (control plane).
  const tenantTheme = null;
  return (
    <html lang="en">
      <body className="bg-ink text-chalk font-body antialiased">
        <TenantThemeStyle theme={tenantTheme} />
        {children}
      </body>
    </html>
  );
}
