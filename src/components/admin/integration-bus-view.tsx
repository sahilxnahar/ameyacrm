'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Radio, CheckCircle2, AlertTriangle, Activity, Play } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RecordList } from '@/components/shared/record-row';
import { runWebhookWorker } from '@/server/actions/integrations-bus';

interface Evt { id: string; provider: string; type: string; status: string; externalId: string; retryCount: number; error: string | null; at: string }

const TONE: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  DONE: 'success', PENDING: 'warning', PROCESSING: 'warning', FAILED: 'destructive',
};

export function IntegrationBusView({ counts, events }: { counts: { pending: number; done: number; failed: number; iot: number }; events: Evt[] }) {
  // AMH-029 — router.refresh() re-runs the server components and swaps the
  // new HTML in. router.refresh() threw the whole document away: scroll
  // position, open filters, a half-typed field in another panel, and a
  // second of white screen. The server action already calls revalidatePath,
  // so the data is fresh either way.
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  function runNow() {
    setBusy(true);
    runWebhookWorker().then((r) => {
      setBusy(false);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`Processed ${r.result.processed}, ${r.result.failed} failed, ${r.result.remaining} remaining`);
      router.refresh();
    })
      .catch(() => {
        // A rejected server action never reaches .then, so the flag the
        // success path clears was never cleared: the button stayed disabled
        // with a spinner until someone reloaded the page.
        setBusy(false);
        toast.error('Could not reach the server. Nothing was saved — check your connection and try again.');
      });
  }
  return (
    <div className="space-y-6">
      <div className="stat-grid">
        <StatCard label="Pending" value={counts.pending} icon={Radio} tone={counts.pending ? 'warning' : 'default'} />
        <StatCard label="Processed" value={counts.done} icon={CheckCircle2} tone="success" />
        <StatCard label="Failed" value={counts.failed} icon={AlertTriangle} tone={counts.failed ? 'destructive' : 'default'} />
        <StatCard label="IoT readings" value={counts.iot} icon={Activity} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Events drain automatically via <code>/api/cron/worker</code> and the daily cron.</p>
        <Button onClick={runNow} disabled={busy} className="gap-1"><Play className="h-4 w-4" /> {busy ? 'Running…' : 'Run worker now'}</Button>
      </div>

      <RecordList empty="No integration events yet. Point a Razorpay webhook at /api/webhooks/razorpay or a sensor at /api/iot/ingest.">
        {events.map((e) => (
          <div key={e.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
            <Badge variant="secondary" className="shrink-0">{e.provider}</Badge>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{e.type}</div>
              <div className="truncate text-xs text-muted-foreground"><span className="font-mono">{e.externalId}</span>{e.retryCount ? ` · ${e.retryCount} retries` : ''}{e.error ? ` · ${e.error}` : ''}</div>
            </div>
            <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{new Date(e.at).toLocaleString()}</span>
            <Badge variant={TONE[e.status] ?? 'secondary'} className="shrink-0">{e.status}</Badge>
          </div>
        ))}
      </RecordList>
    </div>
  );
}
