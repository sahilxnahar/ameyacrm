import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import type { LucideIcon } from 'lucide-react';

export function StatCard({
  label, value, icon: Icon, hint, tone = 'default',
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  tone?: 'default' | 'success' | 'warning' | 'destructive';
}) {
  const tones = {
    default: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-brass-deep bg-warning/20',
    destructive: 'text-destructive bg-destructive/10',
  } as const;
  return (
    <Card>
      {/* Stacked on a phone: side by side left "Follow-ups ..." with the label
          cut off, which is worse than a slightly taller card. */}
      <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11', tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-semibold leading-tight tabular-nums">{value}</p>
          {/* Wraps to two lines rather than truncating — a label nobody can
              read is not a label. */}
          <p className="text-xs leading-snug text-muted-foreground">{label}</p>
          {hint && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground/70">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
