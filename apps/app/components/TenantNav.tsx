'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  href: string;
  label: string;
}

/** Sidebar navigation — items arrive already entitlement-filtered from the server. */
export function TenantNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex md:flex-col gap-0.5 overflow-x-auto md:overflow-visible">
      {items.map((item) => {
        const active =
          item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`md:mx-3 px-3 py-2 font-body text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
              active
                ? 'text-brand bg-brand-50'
                : 'text-mute-1 hover:text-brand hover:bg-surface'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
