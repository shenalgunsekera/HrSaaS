'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  href: string;
  label: string;
}

/** Top navigation — items arrive already entitlement-filtered from the server. */
export function TenantNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap items-center gap-1 overflow-x-auto">
      {items.map((item) => {
        const active =
          item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-4 py-2 font-body text-xs tracking-widest uppercase transition-colors whitespace-nowrap ${
              active
                ? 'text-brand border-b-2 border-brand'
                : 'text-mute-2 hover:text-brand border-b-2 border-transparent'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
