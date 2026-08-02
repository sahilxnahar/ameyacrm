'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

/**
 * A row of sibling registers on one screen.
 *
 * "Governance & Risk" is not one register, it is four — risks, contracts,
 * insurance and licence renewals — and the menu has always said so. Splitting
 * them into four menu entries would bury them; putting them behind a query
 * parameter on the screen they belong to keeps the menu the size it is and
 * makes each one linkable (a renewal alert can point straight at the register
 * that owns it).
 */
export function RegisterTabs({ basePath, current, tabs, projectId }: {
  basePath: string;
  current: string;
  tabs: { key: string; label: string; count?: number }[];
  projectId?: string | null;
}) {
  const href = (key: string) => {
    const params = new URLSearchParams();
    if (key) params.set('view', key);
    if (projectId) params.set('project', projectId);
    const q = params.toString();
    return q ? `${basePath}?${q}` : basePath;
  };

  return (
    <div className="-mx-1 flex flex-wrap gap-1.5 overflow-x-auto px-1 pb-1">
      {tabs.map((t) => {
        const active = t.key === current;
        return (
          <Link
            key={t.key}
            href={href(t.key)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
              active ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-muted',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn('rounded-full px-1.5 text-xs tabular-nums', active ? 'bg-primary-foreground/20' : 'bg-muted text-muted-foreground')}>
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
