'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Send, Clock, CheckCircle2, HandCoins, Play, RefreshCw, X, Plus } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RecordList } from '@/components/shared/record-row';
import { formatCurrency } from '@/lib/utils/format';
import { runDemands, resendPendingDemands, cancelDemand, setBuyerLanguage, createDemand } from '@/server/actions/demands';
import { DEMAND_LANGS } from '@/lib/i18n/demand-templates';

interface Row {
  id: string; number: string; label: string; kind: string; status: string;
  amount: number; dueDate: string | null; sentVia: string | null;
  reminderCount: number; lastError: string | null; buyer: string; unit: string | null;
  leadId: string | null; lang: string;
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  PAID: 'success', SENT: 'secondary', PENDING: 'warning', CANCELLED: 'destructive',
};

export interface BookingOption { id: string; label: string }

export function DemandsView({ counts, rows, bookings = [], canManage = false }: {
  counts: { pending: number; sent: number; paid: number; outstanding: number };
  rows: Row[];
  bookings?: BookingOption[];
  canManage?: boolean;
}) {
  const [busy, setBusy] = React.useState<null | 'run' | 'resend' | 'raise'>(null);
  const [raising, setRaising] = React.useState(false);

  function run() {
    setBusy('run');
    runDemands().then((r) => {
      setBusy(null);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`${r.result.created} new · ${r.result.dispatched} sent · ${r.result.closed} closed · ${r.result.skipped} need contact`);
      location.reload();
    });
  }
  function resend() {
    setBusy('resend');
    resendPendingDemands().then((r) => {
      setBusy(null);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`Re-sent ${r.dispatched} pending demand(s)`);
      location.reload();
    });
  }
  function cancel(id: string) {
    cancelDemand(id).then((r) => {
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Demand cancelled');
      location.reload();
    });
  }
  function changeLang(leadId: string, lang: string) {
    setBuyerLanguage(leadId, lang).then((r) => {
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Buyer language set — future reminders will use it');
    });
  }

  return (
    <div className="space-y-6">
      <div className="stat-grid">
        <StatCard label="Outstanding demanded" value={formatCurrency(counts.outstanding)} icon={HandCoins} tone={counts.outstanding ? 'warning' : 'default'} />
        <StatCard label="Awaiting dispatch" value={counts.pending} icon={Clock} tone={counts.pending ? 'warning' : 'default'} />
        <StatCard label="Sent" value={counts.sent} icon={Send} />
        <StatCard label="Paid" value={counts.paid} icon={CheckCircle2} tone="success" />
      </div>

      <div className="toolbar items-center gap-2">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            Demands generate and dispatch automatically each day. Run a cycle now, or re-send anything still pending.
          </p>
          {/*
            This screen is money BUYERS owe you, raised against a booking — a unit
            sale. It is not where a supplier's bill goes. Offering "Raise a demand"
            with an empty booking list produced a form that could never be
            submitted and no explanation of why, so people assumed it was broken.
          */}
          {!bookings.length && (
            <p className="mt-1 text-xs text-muted-foreground">
              This is for money <strong>buyers owe you</strong>, against a unit booking. If a supplier has
              billed <em>you</em>, record it on <a href="/billing" className="text-brass hover:underline">Billing</a> and
              pay it from <a href="/payments" className="text-brass hover:underline">Payments Made</a>.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {canManage && bookings.length > 0 && (
            <Button variant="outline" onClick={() => setRaising((v) => !v)} className="gap-1">
              <Plus className="h-4 w-4" /> Raise a demand
            </Button>
          )}
          <Button variant="outline" onClick={resend} disabled={busy !== null} className="gap-1"><RefreshCw className="h-4 w-4" /> {busy === 'resend' ? 'Sending…' : 'Re-send pending'}</Button>
          <Button onClick={run} disabled={busy !== null} className="gap-1"><Play className="h-4 w-4" /> {busy === 'run' ? 'Running…' : 'Run demand cycle'}</Button>
        </div>
      </div>

      {/* A one-off ask — a maintenance deposit, a corpus contribution, an agreed
          part-payment. Nothing on this screen could be raised by hand before, so
          anything outside the payment schedule got sent from somebody's own
          WhatsApp and never chased. */}
      {raising && canManage && (
        <form
          className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setBusy('raise');
            createDemand({
              bookingId: String(fd.get('bookingId') ?? ''),
              label: String(fd.get('label') ?? ''),
              amount: Number(fd.get('amount') ?? 0),
              dueDate: String(fd.get('dueDate') ?? '') || null,
            }).then((r) => {
              setBusy(null);
              if ('error' in r) { toast.error(r.error); return; }
              toast.success(`${r.number} raised — it will go out on the next dispatch`);
              setRaising(false); location.reload();
            });
          }}
        >
          <div className="min-w-0 flex-1 space-y-1 sm:flex-none">
            <label htmlFor="dbooking" className="block text-xs font-medium text-muted-foreground">Booking</label>
            <select id="dbooking" name="bookingId" required className="h-9 w-full max-w-full sm:w-72 rounded-md border bg-background px-2 text-sm" defaultValue="">
              <option value="" disabled>Pick a booking…</option>
              {bookings.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </div>
          <div className="min-w-0 flex-1 space-y-1 sm:flex-none">
            <label htmlFor="dlabel" className="block text-xs font-medium text-muted-foreground">What for</label>
            <input id="dlabel" name="label" required className="h-9 w-full max-w-full sm:w-64 rounded-md border bg-background px-2 text-sm" placeholder="Maintenance deposit" />
          </div>
          <div className="min-w-0 flex-1 space-y-1 sm:flex-none">
            <label htmlFor="damount" className="block text-xs font-medium text-muted-foreground">Amount (₹)</label>
            <input id="damount" name="amount" type="number" required inputMode="numeric" className="h-9 w-full max-w-full sm:w-36 rounded-md border bg-background px-2 text-right text-sm tabular-nums" />
          </div>
          <div className="min-w-0 flex-1 space-y-1 sm:flex-none">
            <label htmlFor="ddue" className="block text-xs font-medium text-muted-foreground">Due</label>
            <input id="ddue" name="dueDate" type="date" className="h-9 rounded-md border bg-background px-2 text-sm" />
          </div>
          <Button type="submit" disabled={busy !== null}>{busy === 'raise' ? 'Raising…' : 'Raise it'}</Button>
          <Button type="button" variant="ghost" onClick={() => setRaising(false)}>Cancel</Button>
          {!bookings.length && <p className="w-full text-xs text-muted-foreground">There are no bookings to raise a demand against yet.</p>}
        </form>
      )}

      <RecordList empty="No demands yet. When a payment milestone falls due or goes overdue, a reminder is raised here automatically.">
        {rows.map((d) => (
          <div key={d.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
            <Badge variant={d.kind === 'OVERDUE' ? 'destructive' : 'secondary'} className="shrink-0">{d.kind}</Badge>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{d.buyer}{d.unit ? ` · ${d.unit}` : ''} — {d.label}</div>
              <div className="truncate text-xs text-muted-foreground">
                <span className="font-mono">{d.number}</span>
                {d.dueDate ? ` · due ${new Date(d.dueDate).toLocaleDateString('en-IN')}` : ''}
                {d.sentVia ? ` · via ${d.sentVia}` : ''}
                {d.reminderCount ? ` · ${d.reminderCount} reminder${d.reminderCount > 1 ? 's' : ''}` : ''}
                {d.lastError ? ` · ${d.lastError}` : ''}
              </div>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(d.amount)}</span>
            {d.leadId ? (
              <select
                className="hidden h-7 shrink-0 rounded border bg-background px-1 text-xs sm:block"
                value={d.lang}
                title="Buyer's reminder language"
                onChange={(e) => changeLang(d.leadId!, e.target.value)}
              >
                {DEMAND_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            ) : null}
            <Badge variant={STATUS_TONE[d.status] ?? 'secondary'} className="shrink-0">{d.status}</Badge>
            {d.status !== 'PAID' && d.status !== 'CANCELLED' ? (
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => cancel(d.id)} title="Cancel demand"><X className="h-4 w-4" /></Button>
            ) : null}
          </div>
        ))}
      </RecordList>
    </div>
  );
}
