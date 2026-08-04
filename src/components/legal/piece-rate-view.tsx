'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Ruler, IndianRupee, Plus, CheckCircle2 } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RecordList } from '@/components/shared/record-row';
import { formatCurrency } from '@/lib/utils/format';
import { savePieceRateEntry, settlePieceRate, type PieceRateInput } from '@/server/actions/labour-billing';

interface Row { id: string; workItem: string; unit: string; quantity: number; ratePerUnit: number; amount: number; project: string; vendor: string; settled: boolean; measuredOn: string }

export function PieceRateView({ counts, rows, projects, vendors }: { counts: { unsettled: number; total: number }; rows: Row[]; projects: { id: string; name: string }[]; vendors: { id: string; name: string }[] }) {
  // AMH-029 — router.refresh() re-runs the server components and swaps the
  // new HTML in. router.refresh() threw the whole document away: scroll
  // position, open filters, a half-typed field in another panel, and a
  // second of white screen. The server action already calls revalidatePath,
  // so the data is fresh either way.
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<PieceRateInput>({ projectId: '', workItem: '', unit: 'SQFT', quantity: 0, ratePerUnit: 0 });
  function set<K extends keyof PieceRateInput>(k: K, v: PieceRateInput[K]) { setForm((f) => ({ ...f, [k]: v })); }
  const preview = (Number(form.quantity) || 0) * (Number(form.ratePerUnit) || 0);
  function submit() {
    if (!form.projectId || !form.workItem.trim()) { toast.error('Project and work item required.'); return; }
    setSaving(true);
    savePieceRateEntry(form).then((r) => { setSaving(false); if ('error' in r) { toast.error(r.error); return; } toast.success('Entry recorded'); setOpen(false); router.refresh(); })
      .catch(() => {
        // A rejected server action never reaches .then, so the flag the
        // success path clears was never cleared: the button stayed disabled
        // with a spinner until someone reloaded the page.
        setSaving(false);
        toast.error('Could not reach the server. Nothing was saved — check your connection and try again.');
      });
  }
  function settle(id: string) {
    settlePieceRate(id).then((r) => { if ('error' in r) { toast.error(r.error); return; } toast.success(`Settled → ${r.voucher}`); router.refresh(); });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard label="Unsettled value" value={formatCurrency(counts.unsettled)} icon={IndianRupee} tone={counts.unsettled ? 'warning' : 'default'} />
        <StatCard label="Entries" value={counts.total} icon={Ruler} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Settling an entry raises a CP- payment voucher — no parallel money table.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-1"><Plus className="h-4 w-4" /> New measurement</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Record piece-rate output</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Project *</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.projectId} onChange={(e) => set('projectId', e.target.value)}><option value="">Select…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              </div>
              <div>
                <Label>Sub-contractor</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.vendorId ?? ''} onChange={(e) => set('vendorId', e.target.value || null)}><option value="">—</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
              </div>
              <div className="col-span-2"><Label>Work item *</Label><Input value={form.workItem} onChange={(e) => set('workItem', e.target.value)} placeholder="Internal plastering — Tower A" /></div>
              <div><Label>Unit</Label><Input value={form.unit ?? 'SQFT'} onChange={(e) => set('unit', e.target.value)} /></div>
              <div><Label>Quantity</Label><Input type="number" step="0.001" value={form.quantity || ''} onChange={(e) => set('quantity', Number(e.target.value))} /></div>
              <div><Label>Rate / unit (₹)</Label><Input type="number" step="0.01" value={form.ratePerUnit || ''} onChange={(e) => set('ratePerUnit', Number(e.target.value))} /></div>
              <div className="flex items-end"><div className="text-sm">Amount: <span className="font-semibold">{formatCurrency(preview)}</span></div></div>
            </div>
            <div className="mt-2 flex justify-end"><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Record'}</Button></div>
          </DialogContent>
        </Dialog>
      </div>
      <RecordList empty="Piece-rate work is paid on what was measured, not on days attended. Record the measurement and the rate; the bill follows.">
        {rows.map((e) => (
          <div key={e.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{e.workItem}</div>
              <div className="truncate text-xs text-muted-foreground">{e.vendor} · {e.project} · {e.quantity} {e.unit} × {formatCurrency(e.ratePerUnit)}</div>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(e.amount)}</span>
            {e.settled ? <Badge variant="success" className="shrink-0">settled</Badge> : <Button size="sm" className="shrink-0 gap-1" onClick={() => settle(e.id)}><CheckCircle2 className="h-4 w-4" /> Settle</Button>}
          </div>
        ))}
      </RecordList>
    </div>
  );
}
