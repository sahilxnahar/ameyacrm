import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

/**
 * One empty state everywhere. An empty screen should say what belongs here and
 * offer the next step — "No data" tells a new user nothing.
 */
export function EmptyState({
  icon: Icon, title, body, actionLabel, actionHref, className,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border border-dashed p-10 text-center', className)}>
      {Icon && (
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-secondary">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </span>
      )}
      <p className="font-medium">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {actionLabel && actionHref && (
        <Link href={actionHref} className="mt-4 inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
