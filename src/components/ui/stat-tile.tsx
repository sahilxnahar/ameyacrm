import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * One stat tile everywhere. Before this, the finance and site screens each
 * declared their own `Tile` inline and they had already drifted — different
 * padding, different "bad" red. This is the single definition; a screen passes a
 * label, a value and an optional tone, and every KPI row looks the same.
 */
export function StatTile({
  label, value, sub, icon, tone = 'default', className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  /** `bad` paints the value in the danger colour, `good` in success. */
  tone?: 'default' | 'bad' | 'good';
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border bg-card p-3', className)}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          'mt-1 font-display text-xl font-semibold',
          tone === 'bad' && 'text-destructive',
          tone === 'good' && 'text-success',
        )}
      >
        {value}
      </div>
      {sub != null && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

/** A responsive row of stat tiles — two up on a phone, N up on a wide screen. */
export function StatTileRow({ cols = 4, children, className }: { cols?: 3 | 4 | 5; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3',
        cols === 3 && 'sm:grid-cols-3',
        cols === 4 && 'sm:grid-cols-4',
        cols === 5 && 'sm:grid-cols-5',
        className,
      )}
    >
      {children}
    </div>
  );
}
