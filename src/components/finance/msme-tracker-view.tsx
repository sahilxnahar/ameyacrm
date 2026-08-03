'use client';
import * as React from 'react';
import { AlertTriangle, Clock, IndianRupee } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Badge } from '@/components/ui/badge';
import { RecordList } from '@/components/shared/record-row';
import { formatCurrency } from '@/lib/utils/format';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { createMsmeClock } from '@/server/actions/finance-tax';

interface Row { id: string; vendor: string; udyamNo: string | null; amount: number; billDate: string; dueDate: string; status: string }
const TONE: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = { PAID: 'success', ON_TIME: 'secondary', DUE_SOON: 'warning', OVERDUE: 'destructive', DISALLOWED: 'destructive' };
function fmt(d: string) { return new Date(d).toLocaleDateString('en-IN'); }
function daysLeft(due: string) { return Math.round((new Date(due).getTime() - Date.now()) / 864e5); }

export interface Candidate { id: string; number: string; vendorId: string; vendor: string; amount: number; billDate: string }

export function MsmeTrackerView({ counts, rows, canManage = false, candidates = [] }: {
  counts: { overdue: number; dueSoon: number; outstanding: number };
  rows: Row[];
  canManage?: boolean;
  candidates?: Candidate[];
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Overdue / disallowed" value={counts.overdue} icon={AlertTriangle} tone={counts.overdue ? 'destructive' : 'default'} />
        <StatCard label="Due within 7 days" value={counts.dueSoon} icon={Clock} tone={counts.dueSoon ? 'warning' : 'default'} />
        <StatCard label="Outstanding MSME" value={formatCurrency(counts.outstanding)} icon={IndianRupee} />
      </div>
      {canManage && <StartClock candidates={candidates} />}
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

/**
 * Put an existing supplier bill on the 45-day clock.
 *
 * Section 43B(h) does not care whether anybody ticked an MSME box when the bill
 * was typed — the deduction is disallowed either way. This is the way back: pick
 * the bill, put the Udyam number against it, say whether there is a written
 * agreement (15 days without one, 45 with), and the countdown starts.
 */
function StartClock({ candidates }: { candidates: Candidate[] }) {
  const [billId, setBillId] = React.useState('');
  const [udyam, setUdyam] = React.useState('');
  const [hasAgreement, setHasAgreement] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const bill = candidates.find((c) => c.id === billId) ?? null;

  if (!candidates.length) {
    return (
      <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        Every unpaid supplier bill is already on a clock, or there are none to track. Record a bill on the Billing
        screen and it will show up here.
      </p>
    );
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!bill) { toast.error('Pick the bill first.'); return; }
        setBusy(true);
        createMsmeClock({
          vendorId: bill.vendorId, vendorBillId: bill.id, billDate: bill.billDate,
          amount: bill.amount, udyamNo: udyam.trim() || null, hasAgreement,
        }).then((r) => {
          setBusy(false);
          if ('error' in r) { toast.error(r.error); return; }
          toast.success(`${bill.number} is on the clock`);
          location.reload();
        });
      }}
    >
      <div className="min-w-0 flex-1 space-y-1 sm:flex-none">
        <Label htmlFor="mbill">Supplier bill</Label>
        <select id="mbill" value={billId} onChange={(e) => setBillId(e.target.value)} className="h-9 w-full max-w-full sm:w-80 rounded-md border bg-background px-2 text-sm">
          <option value="">Pick a bill…</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>{c.vendor} · {c.number} · {formatCurrency(c.amount)}</option>
          ))}
        </select>
      </div>
      <div className="min-w-0 flex-1 space-y-1 sm:flex-none">
        <Label htmlFor="mudyam">Udyam number</Label>
        <input id="mudyam" value={udyam} onChange={(e) => setUdyam(e.target.value)} className="h-9 w-full max-w-full sm:w-56 rounded-md border bg-background px-2 font-mono text-sm" placeholder="UDYAM-KR-03-0001234" />
      </div>
      <label className="flex h-9 items-center gap-2 text-sm">
        <input type="checkbox" checked={hasAgreement} onChange={(e) => setHasAgreement(e.target.checked)} className="h-4 w-4" />
        Written agreement (45 days, not 15)
      </label>
      <Button type="submit" variant="outline" disabled={busy || !billId}>{busy ? 'Starting…' : 'Start the clock'}</Button>
      {bill && (
        <p className="w-full text-xs text-muted-foreground">
          {bill.vendor} · {formatCurrency(bill.amount)} · bill dated {new Date(bill.billDate).toLocaleDateString('en-IN')} ·
          {' '}due in {hasAgreement ? 45 : 15} days from the bill date.
        </p>
      )}
    </form>
  );
}
