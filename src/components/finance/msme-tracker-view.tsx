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
import { createMsmeClock, createMsmeBillManually } from '@/server/actions/finance-tax';
import { cn } from '@/lib/utils/cn';

interface Row { id: string; vendor: string; udyamNo: string | null; amount: number; billDate: string; dueDate: string; status: string }
const TONE: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = { PAID: 'success', ON_TIME: 'secondary', DUE_SOON: 'warning', OVERDUE: 'destructive', DISALLOWED: 'destructive' };
function fmt(d: string) { return new Date(d).toLocaleDateString('en-IN'); }
function daysLeft(due: string) { return Math.round((new Date(due).getTime() - Date.now()) / 864e5); }

export interface Candidate { id: string; number: string; vendorId: string; vendor: string; amount: number; billDate: string }
export interface VendorOption { id: string; name: string; udyamNo?: string | null }

export function MsmeTrackerView({ counts, rows, canManage = false, candidates = [], vendors = [] }: {
  counts: { overdue: number; dueSoon: number; outstanding: number };
  rows: Row[];
  canManage?: boolean;
  candidates?: Candidate[];
  vendors?: VendorOption[];
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Overdue / disallowed" value={counts.overdue} icon={AlertTriangle} tone={counts.overdue ? 'destructive' : 'default'} />
        <StatCard label="Due within 7 days" value={counts.dueSoon} icon={Clock} tone={counts.dueSoon ? 'warning' : 'default'} />
        <StatCard label="Outstanding MSME" value={formatCurrency(counts.outstanding)} icon={IndianRupee} />
      </div>
      {canManage && <AddMsme candidates={candidates} vendors={vendors} />}
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
/**
 * Two ways in: pick a bill already in the books, or type a new one.
 *
 * The screen used to offer only the first, and when there were no unpaid bills
 * it offered nothing at all — a dead end that told you to go to Billing, record
 * the bill, and come back. Four steps across two screens at the exact moment
 * the 45-day clock has already started, because s.43B(h) runs from the date on
 * the supplier's bill, not from the date somebody got round to typing it.
 */
function AddMsme({ candidates, vendors }: { candidates: Candidate[]; vendors: VendorOption[] }) {
  // Default to whichever tab can actually do something.
  const [mode, setMode] = React.useState<'existing' | 'new'>(candidates.length ? 'existing' : 'new');
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-3 inline-flex rounded-lg border bg-background p-0.5">
        {([['existing', `A bill already recorded${candidates.length ? ` (${candidates.length})` : ''}`], ['new', 'Type a new bill']] as const).map(([m, label]) => (
          <button
            key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
            disabled={m === 'existing' && !candidates.length}
            className={cn('focus-ring rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-40',
              mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary')}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'existing'
        ? (candidates.length
            ? <StartClock candidates={candidates} />
            : <p className="text-sm text-muted-foreground">Every unpaid supplier bill is already on a clock. Use <strong>Type a new bill</strong> for one that is not in the system yet.</p>)
        : <ManualMsmeBill vendors={vendors} />}
    </div>
  );
}

/**
 * Record the bill and start its clock in one step.
 *
 * This goes through the same `createVendorBill` path as the Billing screen, so
 * the bill lands in the ledger with the same liability and the same GST
 * treatment. A second, quieter way into the books is how two screens end up
 * disagreeing about what is owed.
 */
function ManualMsmeBill({ vendors }: { vendors: VendorOption[] }) {
  const [vendorId, setVendorId] = React.useState('');
  const [number, setNumber] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [gst, setGst] = React.useState('');
  const [billDate, setBillDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [udyam, setUdyam] = React.useState('');
  const [hasAgreement, setHasAgreement] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  // Prefill the Udyam number from the supplier record when there is one, so it
  // is not retyped for every bill from the same supplier.
  React.useEffect(() => {
    const v = vendors.find((x) => x.id === vendorId);
    if (v?.udyamNo) setUdyam(v.udyamNo);
  }, [vendorId, vendors]);

  const due = React.useMemo(() => {
    const d = new Date(billDate);
    if (Number.isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + (hasAgreement ? 45 : 15));
    return d;
  }, [billDate, hasAgreement]);

  if (!vendors.length) {
    return (
      <p className="text-sm text-muted-foreground">
        There are no suppliers on file yet. Add one on <a href="/vendor-registry" className="text-brass hover:underline">Vendors</a>,
        then the bill can be entered here.
      </p>
    );
  }

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        createMsmeBillManually({
          vendorId, number, amount: Number(amount), gstAmount: Number(gst || 0),
          billDate, udyamNo: udyam.trim() || null, hasAgreement,
        }).then((r) => {
          setBusy(false);
          if ('error' in r) { toast.error(r.error); return; }
          toast.success(`${r.number} recorded — payable by ${new Date(r.dueDate).toLocaleDateString('en-IN')}`);
          location.reload();
        })
          .catch(() => {
            // A rejected server action never reaches .then, so the flag the
            // success path clears was never cleared: the button stayed disabled
            // with a spinner until someone reloaded the page.
            setBusy(false);
            toast.error('Could not reach the server. Nothing was saved — check your connection and try again.');
          });
      }}
    >
      <div className="min-w-0 flex-1 space-y-1 sm:flex-none">
        <Label htmlFor="mv">Supplier</Label>
        <select id="mv" required value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="h-9 w-full max-w-full sm:w-56 rounded-md border bg-background px-2 text-sm">
          <option value="">Pick a supplier…</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>
      <div className="min-w-0 flex-1 space-y-1 sm:flex-none">
        <Label htmlFor="mn">Their bill number</Label>
        <input id="mn" required value={number} onChange={(e) => setNumber(e.target.value)} placeholder="INV-2291" className="h-9 w-full max-w-full sm:w-36 rounded-md border bg-background px-2 font-mono text-sm" />
      </div>
      <div className="min-w-0 flex-1 space-y-1 sm:flex-none">
        <Label htmlFor="ma">Amount (₹)</Label>
        <input id="ma" required type="number" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9 w-full max-w-full sm:w-32 rounded-md border bg-background px-2 text-right text-sm tabular-nums" />
      </div>
      <div className="min-w-0 flex-1 space-y-1 sm:flex-none">
        <Label htmlFor="mg">GST (₹)</Label>
        <input id="mg" type="number" inputMode="decimal" step="0.01" value={gst} onChange={(e) => setGst(e.target.value)} className="h-9 w-full max-w-full sm:w-28 rounded-md border bg-background px-2 text-right text-sm tabular-nums" />
      </div>
      <div className="min-w-0 flex-1 space-y-1 sm:flex-none">
        <Label htmlFor="md">Bill date</Label>
        <input id="md" required type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm" />
      </div>
      <div className="min-w-0 flex-1 space-y-1 sm:flex-none">
        <Label htmlFor="mu">Udyam number</Label>
        <input id="mu" value={udyam} onChange={(e) => setUdyam(e.target.value)} placeholder="UDYAM-KR-03-0001234" className="h-9 w-full max-w-full sm:w-52 rounded-md border bg-background px-2 font-mono text-sm" />
      </div>
      <label className="flex h-9 items-center gap-2 text-sm">
        <input type="checkbox" checked={hasAgreement} onChange={(e) => setHasAgreement(e.target.checked)} className="h-4 w-4" />
        Written agreement (45 days, not 15)
      </label>
      <Button type="submit" disabled={busy}>{busy ? 'Recording…' : 'Record it & start the clock'}</Button>
      {due && (
        <p className="w-full text-xs text-muted-foreground">
          Payable by <strong>{due.toLocaleDateString('en-IN')}</strong> — {hasAgreement ? 45 : 15} days from the bill date.
          Miss it and the deduction is disallowed under s.43B(h). This also records the bill on Billing, with its ledger entry.
        </p>
      )}
    </form>
  );
}

function StartClock({ candidates }: { candidates: Candidate[] }) {
  const [billId, setBillId] = React.useState('');
  const [udyam, setUdyam] = React.useState('');
  const [hasAgreement, setHasAgreement] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const bill = candidates.find((c) => c.id === billId) ?? null;

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
        })
          .catch(() => {
            // A rejected server action never reaches .then, so the flag the
            // success path clears was never cleared: the button stayed disabled
            // with a spinner until someone reloaded the page.
            setBusy(false);
            toast.error('Could not reach the server. Nothing was saved — check your connection and try again.');
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
