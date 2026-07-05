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
            className={`px-4 py-2.5 font-body text-xs tracking-widest uppercase transition-colors whitespace-nowrap border-l-2 ${
              active
                ? 'text-brand border-brand bg-brand-50'
                : 'text-mute-2 border-transparent hover:text-brand hover:border-line'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
