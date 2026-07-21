import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Sparkline } from './sparkline';

/**
 * One stat tile everywhere. A screen passes a label, a value and an optional
 * tone. It can now also carry a tiny trend line (`spark`) and a trend chip
 * (`trend`) so a KPI tells a story at a glance (V3), and it lifts a touch on
 * hover for a more alive feel (V1/V2).
 */
export function StatTile({
  label, value, sub, icon, tone = 'default', spark, trend, className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  /** `bad` paints the value in the danger colour, `good` in success. */
  tone?: 'default' | 'bad' | 'good';
  /** A row of numbers to draw as a tiny trend line. */
  spark?: number[];
  /** A small up/down chip beside the value. */
  trend?: { dir: 'up' | 'down'; label: string };
  className?: string;
}) {
  return (
    <div className={cn('card-surface rounded-lg border bg-card p-3 transition-shadow', className)}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div
          className={cn(
            'font-display text-xl font-semibold leading-none',
            tone === 'bad' && 'text-destructive',
            tone === 'good' && 'text-success',
          )}
        >
          {value}
        </div>
        {spark && spark.length > 1 && <Sparkline data={spark} className="shrink-0 opacity-80" />}
      </div>
      <div className="mt-1 flex items-center gap-2">
        {trend && (
          <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-medium', trend.dir === 'up' ? 'text-success' : 'text-destructive')}>
            {trend.dir === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend.label}
          </span>
        )}
        {sub != null && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
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
