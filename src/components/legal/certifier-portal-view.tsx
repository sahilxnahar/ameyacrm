'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Stamp, FileCheck2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RecordList } from '@/components/shared/record-row';
import { certifyEngineerPeriod } from '@/server/actions/legal-contracts';
import type { CertifierItem } from '@/server/services/certifier-service';

export function CertifierPortalView({ items, pendingRaBills }: { items: CertifierItem[]; pendingRaBills: number }) {
  // AMH-029 — router.refresh() re-runs the server components and swaps the
  // new HTML in. router.refresh() threw the whole document away: scroll
  // position, open filters, a half-typed field in another panel, and a
  // second of white screen. The server action already calls revalidatePath,
  // so the data is fresh either way.
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  function certify(it: CertifierItem) {
    setBusy(it.contractId);
    certifyEngineerPeriod(it.contractId, it.period, true, 'Cleared via certifier portal').then((r) => {
      setBusy(null);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`Certified ${it.contract} for ${it.period} — payment released`);
      router.refresh();
    })
      .catch(() => {
        // A rejected server action never reaches .then, so the flag the
        // success path clears was never cleared: the button stayed disabled
        // with a spinner until someone reloaded the page.
        setBusy(null);
        toast.error('Could not reach the server. Nothing was saved — check your connection and try again.');
      });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Awaiting certification" value={items.length} icon={Stamp} tone={items.length ? 'warning' : 'success'} />
        <StatCard label="RA bills pending" value={pendingRaBills} icon={FileCheck2} tone={pendingRaBills ? 'warning' : 'default'} />
        <StatCard label="Contracts in scope" value={new Set(items.map((i) => i.contractId)).size} icon={ShieldCheck} />
      </div>

      <RecordList empty="Nothing awaiting sign-off. Every active contract is certified for this month.">
        {items.map((it) => (
          <div key={`${it.contractId}-${it.period}`} className="flex items-center gap-3 border-b px-3 py-3 last:border-b-0">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{it.contract} <span className="font-mono text-xs text-muted-foreground">{it.contractNo}</span></div>
              <div className="truncate text-xs text-muted-foreground">{it.vendor} · {it.project} · period {it.period}{it.held ? ' · currently held' : ''}</div>
            </div>
            {it.held ? <Badge variant="destructive" className="shrink-0">held</Badge> : <Badge variant="warning" className="shrink-0">uncertified</Badge>}
            <Button size="sm" className="shrink-0 gap-1" disabled={busy === it.contractId} onClick={() => certify(it)}>
              <CheckCircle2 className="h-4 w-4" /> {busy === it.contractId ? 'Certifying…' : 'Certify & release'}
            </Button>
          </div>
        ))}
      </RecordList>

      <p className="text-xs text-muted-foreground">One-click certification writes a cleared <code>EngineerCertification</code> for the period — the same record the RA-bill settlement action checks before releasing payment. Nothing here can be bypassed from the payment side.</p>
    </div>
  );
}
