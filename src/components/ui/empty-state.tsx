import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

/**
 * One empty state everywhere. An empty screen should say what belongs here and
 * offer the next step — "No data" tells a new user nothing.
 *
 * Two things this now distinguishes, because they were being drawn identically
 * and mean opposite things:
 *
 *   - `setup` — nothing here YET. Something needs doing, so offer the doing.
 *   - `calm`  — nothing here BECAUSE it is all done. That is good news and
 *               should look like good news, not like a missing-data warning.
 *
 * A second action is supported because the honest answer is often two routes:
 * "add one by hand" and "connect the thing that adds them for you".
 */
export interface EmptyAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export function EmptyState({
  icon: Icon, title, body, actionLabel, actionHref, onAction, secondary, tone = 'setup', className,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  actionLabel?: string;
  /** A link target for the action. Use this OR `onAction`. */
  actionHref?: string;
  /** A click handler for the action (e.g. open an add form in place). */
  onAction?: () => void;
  /** An optional second route to the same goal. */
  secondary?: EmptyAction;
  tone?: 'setup' | 'calm';
  className?: string;
}) {
  const primaryCls = 'inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-ring';
  const secondaryCls = 'inline-flex h-9 items-center rounded-md border bg-background px-4 text-sm font-medium transition-colors hover:bg-secondary focus-ring';

  return (
    <div
      className={cn(
        'rounded-lg border border-dashed p-10 text-center',
        tone === 'calm' ? 'border-success/30 bg-success/5' : '',
        className,
      )}
    >
      {Icon && (
        <span
          className={cn(
            'mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full',
            tone === 'calm' ? 'bg-success/15' : 'bg-secondary',
          )}
        >
          <Icon className={cn('h-5 w-5', tone === 'calm' ? 'text-success' : 'text-muted-foreground')} />
        </span>
      )}
      <p className="font-medium">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>}

      {((actionLabel && (actionHref || onAction)) || secondary) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {actionLabel && actionHref && !onAction && (
            <Link href={actionHref} className={primaryCls}>{actionLabel}</Link>
          )}
          {actionLabel && onAction && (
            <button type="button" onClick={onAction} className={primaryCls}>{actionLabel}</button>
          )}
          {secondary && (secondary.href ? (
            <Link href={secondary.href} className={secondaryCls}>{secondary.label}</Link>
          ) : (
            <button type="button" onClick={secondary.onClick} className={secondaryCls}>{secondary.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
