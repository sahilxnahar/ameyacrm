'use client';
import * as React from 'react';
import { AlertTriangle, Clock, IndianRupee } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Badge } from '@/components/ui/badge';
import { RecordList } from '@/components/shared/record-row';
import { formatCurrency } from '@/lib/utils/format';

interface Row { id: string; vendor: string; udyamNo: string | null; amount: number; billDate: string; dueDate: string; status: string }
const TONE: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = { PAID: 'success', ON_TIME: 'secondary', DUE_SOON: 'warning', OVERDUE: 'destructive', DISALLOWED: 'destructive' };
function fmt(d: string) { return new Date(d).toLocaleDateString('en-IN'); }
function daysLeft(due: string) { return Math.round((new Date(due).getTime() - Date.now()) / 864e5); }

export function MsmeTrackerView({ counts, rows }: { counts: { overdue: number; dueSoon: number; outstanding: number }; rows: Row[] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Overdue / disallowed" value={counts.overdue} icon={AlertTriangle} tone={counts.overdue ? 'destructive' : 'default'} />
        <StatCard label="Due within 7 days" value={counts.dueSoon} icon={Clock} tone={counts.dueSoon ? 'warning' : 'default'} />
        <StatCard label="Outstanding MSME" value={formatCurrency(counts.outstanding)} icon={IndianRupee} />
      </div>
      <RecordList empty="No MSME bills tracked yet. Flag a supplier's bill as MSME to start its 45-day clock.">
        {rows.map((c) => {
          const dl = daysLeft(c.dueDate);
          return (
            <div key={c.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{c.vendor}{c.udyamNo ? <span className="ml-2 font-mono text-xs text-muted-foreground">{c.udyamNo}</span> : ''}</div>
                <div className="truncate text-xs text-muted-foreground">
                  bill {fmt(c.billDate)} · due {fmt(c.dueDate)} · {c.status === 'PAID' ? 'paid' : dl < 0 ? `${Math.abs(dl)}d overdue` : `${dl}d left`}
                </div>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(c.amount)}</span>
              <Badge variant={TONE[c.status] ?? 'secondary'} className="shrink-0">{c.status.replace(/_/g, ' ')}</Badge>
            </div>
          );
        })}
      </RecordList>
    </div>
  );
}
