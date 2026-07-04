import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HR Platform — System Admin',
  description: 'Vendor control-plane console: tenants, tiers, provisioning, domains.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-ink text-chalk font-body antialiased">{children}</body>
    </html>
  );
}
