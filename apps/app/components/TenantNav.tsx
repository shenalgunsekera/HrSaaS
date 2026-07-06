'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  href: string;
  label: string;
  icon?: string;
}
export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Grouped sidebar navigation — sections arrive already entitlement-filtered
 * from the server; empty groups are dropped here.
 */
export function TenantNav({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const visible = groups.filter((g) => g.items.length > 0);
  return (
    <nav className="flex md:flex-col md:gap-4 gap-2 overflow-x-auto md:overflow-visible">
      {visible.map((group) => (
        <div key={group.label} className="md:px-3">
          <p className="hidden md:block px-3 mb-1 font-body text-[10px] font-semibold tracking-widest uppercase text-mute-3">
            {group.label}
          </p>
          <div className="flex md:flex-col gap-0.5">
            {group.items.map((item) => {
              const active =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2 font-body text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                    active
                      ? 'text-brand bg-brand-50'
                      : 'text-mute-1 hover:text-brand hover:bg-surface'
                  }`}
                >
                  {item.icon && <span className="text-xs opacity-70 w-4 text-center">{item.icon}</span>}
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
