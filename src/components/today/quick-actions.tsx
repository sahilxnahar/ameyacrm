import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface QuickAction { label: string; href: string; icon: LucideIcon }

/**
 * The launchpad row at the top of the day: the handful of things people most
 * often want to *start*, one tap away, so a casual user never has to hunt through
 * the menu to do the common jobs. The page passes only the actions the person is
 * allowed to take.
 */
export function QuickActions({ actions }: { actions: QuickAction[] }) {
  if (actions.length === 0) return null;
  return (
    <div className="mb-5">
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Quick actions</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href + a.label}
              href={a.href}
              className={cn(
                'flex items-center gap-2 rounded-lg border bg-card p-2.5 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5',
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                <Icon className="h-4 w-4 text-[#A07D34]" />
              </span>
              <span className="truncate">{a.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
