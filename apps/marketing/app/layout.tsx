import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HR Platform — HR software for Sri Lankan business',
  description:
    'Multi-tenant HR SaaS: employee records, attendance, leave and statutory payroll, from L1 essentials to L5 AI orchestration.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-ink text-chalk font-body antialiased">{children}</body>
    </html>
  );
}
