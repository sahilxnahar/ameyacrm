import { Badge } from '@/components/ui/badge';

/**
 * One status colour language for the whole app. Before this, each screen decided
 * for itself whether "OVERDUE" was red or amber; now a status maps to a single
 * tone everywhere — green = good/done, amber = needs attention, red = problem,
 * grey = neutral/not-started. Pass any status string; unknown ones read as neutral.
 */
type Tone = 'good' | 'warn' | 'bad' | 'neutral';

const GOOD = ['won', 'approved', 'active', 'paid', 'completed', 'complete', 'done', 'closed', 'resolved', 'accepted', 'passed', 'cleared', 'available', 'booked', 'signed', 'verified', 'success'];
const WARN = ['pending', 'submitted', 'raised', 'in_progress', 'in progress', 'review', 'awaiting', 'hold', 'on_hold', 'partial', 'due', 'draft', 'open', 'costed', 'sent', 'processing'];
const BAD = ['overdue', 'lost', 'rejected', 'cancelled', 'canceled', 'failed', 'blocked', 'breach', 'breached', 'expired', 'defaulted', 'disputed', 'stopped', 'error'];

function toneFor(status: string): Tone {
  const s = status.trim().toLowerCase();
  if (GOOD.includes(s)) return 'good';
  if (BAD.includes(s)) return 'bad';
  if (WARN.includes(s)) return 'warn';
  return 'neutral';
}

const VARIANT: Record<Tone, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  good: 'success',
  warn: 'warning',
  bad: 'destructive',
  neutral: 'secondary',
};

/** Humanise a raw status like `IN_PROGRESS` → `In progress`. */
function label(status: string): string {
  const s = status.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function StatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return <Badge variant={VARIANT[toneFor(status)]} className={className}>{label(status)}</Badge>;
}
