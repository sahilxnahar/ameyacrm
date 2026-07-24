import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import type { LucideIcon } from 'lucide-react';

/**
 * A KPI tile in the elevated dark-admin style: a small uppercase label, a large
 * number, and a faint icon watermark in the corner. One shape used everywhere
 * stats appear, so every dashboard reads as one system.
 */
export function StatCard({
  label, value, icon: Icon, hint, tone = 'default',
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'destructive';
}) {
  const toneText = {
    default: 'text-primary',
    success: 'text-success',
    warning: 'text-brass-deep dark:text-brass-light',
    destructive: 'text-destructive',
  } as const;
  const toneChip = {
    default: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-brass-deep bg-warning/20 dark:text-brass-light',
    destructive: 'text-destructive bg-destructive/10',
  } as const;
  return (
    <Card className="relative overflow-hidden p-4 sm:p-5">
      {/* Faint icon watermark, echoing the KPI tiles in the reference design. */}
      <Icon className={cn('pointer-events-none absolute -bottom-3 -right-2 h-20 w-20 opacity-[0.07]', toneText[tone])} aria-hidden />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', toneChip[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="relative mt-2 text-3xl font-bold leading-none tabular-nums">{value}</p>
      {hint && <p className="relative mt-2 text-[11px] leading-snug text-muted-foreground/80">{hint}</p>}
    </Card>
  );
}
