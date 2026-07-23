'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ListChecks, LayoutDashboard, Users2, BadgeIndianRupee, Menu } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Thumb-reachable bar pinned to the bottom on phones. Five destinations is the
 * limit before targets get too small to hit reliably; everything else lives
 * behind "More", which opens the full menu.
 */
const ITEMS = [
  { href: '/home', label: 'Home', icon: LayoutDashboard, permission: null },
  { href: '/today', label: 'Today', icon: ListChecks, permission: null },
  { href: '/sales', label: 'Leads', icon: Users2, permission: 'lead.view' },
  { href: '/payments', label: 'Money', icon: BadgeIndianRupee, permission: 'finance.ledger.view' },
] as const;

export function MobileNav({
  allowed, isSuperAdmin, onMore,
}: {
  allowed: Set<string>;
  isSuperAdmin: boolean;
  onMore: () => void;
}) {
  const pathname = usePathname();
  // Super admins carry the single key '*', not every individual permission —
  // checking allowed.has() alone wrongly hid most of this bar from them.
  const canSee = (perm?: string | null) => !perm || isSuperAdmin || allowed.has('*') || allowed.has(perm);
  const visible = ITEMS.filter((i) => canSee(i.permission));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        {visible.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground active:bg-secondary',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
              {item.label}
              {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
            </Link>
          );
        })}
        <button
          onClick={onMore}
          className="relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground active:bg-secondary"
        >
          <Menu className="h-5 w-5" />
          More
        </button>
      </div>
    </nav>
  );
}
