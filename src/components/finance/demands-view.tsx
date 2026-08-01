'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Send, Clock, CheckCircle2, HandCoins, Play, RefreshCw, X } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RecordList } from '@/components/shared/record-row';
import { formatCurrency } from '@/lib/utils/format';
import { runDemands, resendPendingDemands, cancelDemand, setBuyerLanguage } from '@/server/actions/demands';
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

export function DemandsView({ counts, rows }: { counts: { pending: number; sent: number; paid: number; outstanding: number }; rows: Row[] }) {
  const [busy, setBusy] = React.useState<null | 'run' | 'resend'>(null);

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
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Outstanding demanded" value={formatCurrency(counts.outstanding)} icon={HandCoins} tone={counts.outstanding ? 'warning' : 'default'} />
        <StatCard label="Awaiting dispatch" value={counts.pending} icon={Clock} tone={counts.pending ? 'warning' : 'default'} />
        <StatCard label="Sent" value={counts.sent} icon={Send} />
        <StatCard label="Paid" value={counts.paid} icon={CheckCircle2} tone="success" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Demands generate and dispatch automatically each day. Run a cycle now, or re-send anything still pending.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resend} disabled={busy !== null} className="gap-1"><RefreshCw className="h-4 w-4" /> {busy === 'resend' ? 'Sending…' : 'Re-send pending'}</Button>
          <Button onClick={run} disabled={busy !== null} className="gap-1"><Play className="h-4 w-4" /> {busy === 'run' ? 'Running…' : 'Run demand cycle'}</Button>
        </div>
      </div>

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
