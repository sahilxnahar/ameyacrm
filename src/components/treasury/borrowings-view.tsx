'use client';

import * as React from 'react';
import { formatCurrency } from '@/lib/utils/format';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Loader2, Landmark, ArrowDownToLine, ArrowUpFromLine, Percent } from 'lucide-react';
import { saveLoan, addLoanEvent } from '@/server/actions/treasury';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface EventRow { id: string; kind: string; amount: number; date: string; note: string | null }
interface Row {
  id: string; lender: string; kind: string; sanctionedAmount: number; interestRate: number | null;
  startedOn: string | null; notes: string | null; isActive: boolean;
  drawn: number; repaid: number; interestPaid: number; outstanding: number; interestAccrued: number; netInterestDue: number;
  events: EventRow[];
}
interface Summary {
  totalOutstanding: number; totalInterestAccrued: number; totalInterestPaid: number;
  totalNetInterestDue: number; weightedAvgRate: number; monthlyInterestRunRate: number;
}

const KIND_LABEL: Record<string, string> = {
  TERM_LOAN: 'Term loan', OVERDRAFT: 'Overdraft', VENTURE_DEBT: 'Venture debt', PROJECT_LOAN: 'Project loan', OTHER: 'Other',
};
const EVENT_LABEL: Record<string, string> = { DRAWDOWN: 'Drawdown', REPAYMENT: 'Repayment', INTEREST: 'Interest paid', FEE: 'Fee' };
const today = () => new Date().toISOString().slice(0, 10);

export function BorrowingsView({ rows, summary, canManage }: { rows: Row[]; summary: Summary; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [facilityOpen, setFacilityOpen] = React.useState(false);
  const [event, setEvent] = React.useState<{ loanId: string; lender: string; kind: 'DRAWDOWN' | 'REPAYMENT' | 'INTEREST' } | null>(null);

  const submitFacility = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await saveLoan({
        lender: fd.get('lender'),
        kind: fd.get('kind'),
        sanctionedAmount: fd.get('sanctionedAmount') ? Number(fd.get('sanctionedAmount')) : undefined,
        interestRate: fd.get('interestRate') ? Number(fd.get('interestRate')) : null,
        startedOn: fd.get('startedOn') || null,
        notes: fd.get('notes') || null,
      });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Facility saved.'); setFacilityOpen(false); router.refresh();
    });
  };

  const submitEvent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!event) return;
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await addLoanEvent({
        loanId: event.loanId,
        kind: event.kind,
        amount: Number(fd.get('amount')),
        eventDate: fd.get('eventDate') || null,
        note: fd.get('note') || null,
      });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`${EVENT_LABEL[event.kind]} recorded.`); setEvent(null); router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      {/* Portfolio totals */}
      <div className="stat-grid">
        <Tile label="Outstanding" value={formatCurrency(summary.totalOutstanding)} hint="Principal still owed across all lenders" />
        <Tile label="Interest due" value={formatCurrency(summary.totalNetInterestDue)} hint="Accrued, not yet paid" />
        <Tile label="Avg. rate" value={`${summary.weightedAvgRate.toFixed(2)}%`} hint="Balance-weighted, per year" />
        <Tile label="Interest / month" value={formatCurrency(summary.monthlyInterestRunRate)} hint="At current balances & rates" />
      </div>

      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setFacilityOpen(true)}><Plus className="h-4 w-4" /> Add facility</Button>
        </div>
      )}

      {rows.length === 0 ? (
        <Card className="p-10 text-center">
          <Landmark className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No borrowings recorded yet</p>
          <p className="text-xs text-muted-foreground">Add a bank or NBFC facility, then record each drawdown as the money comes in.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="toolbar items-start gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-display text-lg">{r.lender}</p>
                    <Badge variant="secondary">{KIND_LABEL[r.kind] ?? r.kind}</Badge>
                    {!r.isActive && <Badge variant="outline">Closed</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.interestRate != null ? `${r.interestRate}% p.a.` : 'No rate set'}
                    {r.sanctionedAmount > 0 ? ` · sanctioned ${formatCurrency(r.sanctionedAmount)}` : ''}
                    {r.startedOn ? ` · since ${new Date(r.startedOn).toLocaleDateString('en-IN')}` : ''}
                  </p>
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEvent({ loanId: r.id, lender: r.lender, kind: 'DRAWDOWN' })}><ArrowDownToLine className="h-4 w-4" /> Drawdown</Button>
                    <Button size="sm" variant="outline" onClick={() => setEvent({ loanId: r.id, lender: r.lender, kind: 'REPAYMENT' })}><ArrowUpFromLine className="h-4 w-4" /> Repayment</Button>
                    <Button size="sm" variant="outline" onClick={() => setEvent({ loanId: r.id, lender: r.lender, kind: 'INTEREST' })}><Percent className="h-4 w-4" /> Interest paid</Button>
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Figure label="Drawn" value={formatCurrency(r.drawn)} />
                <Figure label="Repaid" value={formatCurrency(r.repaid)} />
                <Figure label="Outstanding" value={formatCurrency(r.outstanding)} strong />
                <Figure label="Interest accrued" value={formatCurrency(r.interestAccrued)} />
                <Figure label="Interest paid" value={formatCurrency(r.interestPaid)} />
                <Figure label="Interest due" value={formatCurrency(r.netInterestDue)} strong />
              </div>

              {r.events.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium text-muted-foreground">History ({r.events.length})</summary>
                  <ul className="mt-2 divide-y rounded-md border text-sm">
                    {[...r.events].reverse().slice(0, 20).map((ev) => (
                      <li key={ev.id} className="flex items-center justify-between px-3 py-1.5">
                        <span>{EVENT_LABEL[ev.kind] ?? ev.kind}<span className="text-muted-foreground"> · {new Date(ev.date).toLocaleDateString('en-IN')}</span></span>
                        <span className="tabular-nums">{formatCurrency(ev.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add facility */}
      <Dialog open={facilityOpen} onOpenChange={setFacilityOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add a borrowing facility</DialogTitle><DialogDescription>A loan or overdraft from a bank or NBFC. Record drawdowns afterwards as the money arrives.</DialogDescription></DialogHeader>
          <form onSubmit={submitFacility} className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="lender">Lender (bank or NBFC)</Label><Input id="lender" name="lender" required placeholder="e.g. HDFC Bank, or Bajaj Finance (NBFC)" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label htmlFor="kind">Type</Label>
                <select id="kind" name="kind" defaultValue="TERM_LOAN" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="space-y-1.5"><Label htmlFor="interestRate">Interest rate (% p.a.)</Label><Input id="interestRate" name="interestRate" type="number" step="0.01" min="0" max="100" placeholder="e.g. 14" /></div>
              <div className="space-y-1.5"><Label htmlFor="sanctionedAmount">Sanctioned amount (₹)</Label><Input id="sanctionedAmount" name="sanctionedAmount" type="number" step="1" min="0" placeholder="optional" /></div>
              <div className="space-y-1.5"><Label htmlFor="startedOn">Start date</Label><Input id="startedOn" name="startedOn" type="date" defaultValue={today()} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="notes">Notes</Label><Input id="notes" name="notes" placeholder="optional" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setFacilityOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save facility</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record an event */}
      <Dialog open={!!event} onOpenChange={(o) => { if (!o) setEvent(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{event ? EVENT_LABEL[event.kind] : ''} — {event?.lender}</DialogTitle>
            <DialogDescription>
              {event?.kind === 'DRAWDOWN' && 'Money received from the lender. Interest accrues on it from this date.'}
              {event?.kind === 'REPAYMENT' && 'Principal you paid back. Lowers the balance and future interest.'}
              {event?.kind === 'INTEREST' && 'An interest payment you made to the lender.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEvent} className="space-y-3">
            <div className="space-y-1.5"><Label htmlFor="amount">Amount (₹)</Label><Input id="amount" name="amount" type="number" step="1" min="1" required autoFocus /></div>
            <div className="space-y-1.5"><Label htmlFor="eventDate">Date</Label><Input id="eventDate" name="eventDate" type="date" defaultValue={today()} required /></div>
            <div className="space-y-1.5"><Label htmlFor="note">Note</Label><Input id="note" name="note" placeholder="optional (UTR, reference…)" /></div>
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEvent(null)}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Record</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`tabular-nums ${strong ? 'text-base font-semibold' : 'text-sm'}`}>{value}</p>
    </div>
  );
}
