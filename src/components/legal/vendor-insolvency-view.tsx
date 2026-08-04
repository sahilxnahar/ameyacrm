'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Snowflake, Gavel, Plus } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RecordList } from '@/components/shared/record-row';
import { formatCurrency } from '@/lib/utils/format';
import { saveInsolvencyCase, type InsolvencyInput } from '@/server/actions/legal-contracts';

interface Row {
  id: string; vendor: string; vendorActive: boolean; stage: string; cirpRef: string | null;
  irpName: string | null; ncltBench: string | null; admittedOn: string | null;
  freezeAdvances: boolean; claimFiledInr: number | null;
}
const TONE: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  MORATORIUM: 'destructive', CIRP_ADMITTED: 'destructive', LIQUIDATION: 'destructive',
  FLAGGED: 'warning', RESOLUTION: 'warning', CLOSED: 'secondary',
};
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString('en-IN') : '—'; }

export function VendorInsolvencyView({ counts, rows, vendors }: {
  counts: { frozen: number; total: number };
  rows: Row[];
  vendors: { id: string; name: string }[];
}) {
  // AMH-029 — router.refresh() re-runs the server components and swaps the
  // new HTML in. router.refresh() threw the whole document away: scroll
  // position, open filters, a half-typed field in another panel, and a
  // second of white screen. The server action already calls revalidatePath,
  // so the data is fresh either way.
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<InsolvencyInput>({ vendorId: '', stage: 'FLAGGED', freezeAdvances: true });
  function set<K extends keyof InsolvencyInput>(k: K, v: InsolvencyInput[K]) { setForm((f) => ({ ...f, [k]: v })); }

  function submit() {
    if (!form.vendorId) { toast.error('Vendor is required.'); return; }
    setSaving(true);
    saveInsolvencyCase(form).then((r) => {
      setSaving(false);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Insolvency case saved — advances frozen if applicable'); setOpen(false); router.refresh();
    })
      .catch(() => {
        // A rejected server action never reaches .then, so the flag the
        // success path clears was never cleared: the button stayed disabled
        // with a spinner until someone reloaded the page.
        setSaving(false);
        toast.error('Could not reach the server. Nothing was saved — check your connection and try again.');
      });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard label="Advances frozen" value={counts.frozen} icon={Snowflake} tone={counts.frozen ? 'destructive' : 'default'} />
        <StatCard label="Cases tracked" value={counts.total} icon={Gavel} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Setting a case to CIRP or Moratorium (with freeze on) deactivates the vendor immediately and blocks new payments.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-1"><Plus className="h-4 w-4" /> Flag vendor</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Flag a vendor in insolvency</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Vendor *</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.vendorId} onChange={(e) => set('vendorId', e.target.value)}>
                  <option value="">Select…</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Stage</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.stage} onChange={(e) => set('stage', e.target.value)}>
                  {['FLAGGED', 'CIRP_ADMITTED', 'MORATORIUM', 'RESOLUTION', 'LIQUIDATION', 'CLOSED'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <input id="freeze" type="checkbox" checked={form.freezeAdvances ?? true} onChange={(e) => set('freezeAdvances', e.target.checked)} className="h-4 w-4" />
                <Label htmlFor="freeze">Freeze advances</Label>
              </div>
              <div><Label>NCLT bench</Label><Input value={form.ncltBench ?? ''} onChange={(e) => set('ncltBench', e.target.value)} placeholder="Bengaluru" /></div>
              <div><Label>CIRP ref</Label><Input value={form.cirpRef ?? ''} onChange={(e) => set('cirpRef', e.target.value)} placeholder="CP(IB)/…" /></div>
              <div><Label>IRP / RP name</Label><Input value={form.irpName ?? ''} onChange={(e) => set('irpName', e.target.value)} /></div>
              <div><Label>Admitted on</Label><Input type="date" value={form.admittedOn ?? ''} onChange={(e) => set('admittedOn', e.target.value)} /></div>
              <div className="col-span-2"><Label>Our claim filed (₹)</Label><Input type="number" value={form.claimFiledInr ?? ''} onChange={(e) => set('claimFiledInr', e.target.value ? Number(e.target.value) : null)} /></div>
            </div>
            <div className="mt-2 flex justify-end"><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save & apply freeze'}</Button></div>
          </DialogContent>
        </Dialog>
      </div>

      <RecordList empty="No vendors flagged. Add one when a supplier is admitted into IBC proceedings.">
        {rows.map((c) => (
          <div key={c.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
            {c.freezeAdvances && ['CIRP_ADMITTED', 'MORATORIUM'].includes(c.stage) ? <Snowflake className="h-4 w-4 shrink-0 text-destructive" /> : null}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{c.vendor}{!c.vendorActive ? <span className="ml-2 text-xs text-destructive">(deactivated)</span> : ''}</div>
              <div className="truncate text-xs text-muted-foreground">
                {c.cirpRef ? <span className="font-mono">{c.cirpRef}</span> : 'no CIRP ref'}
                {c.ncltBench ? ` · NCLT ${c.ncltBench}` : ''}{c.irpName ? ` · ${c.irpName}` : ''}
                {c.admittedOn ? ` · admitted ${fmt(c.admittedOn)}` : ''}{c.claimFiledInr ? ` · claim ${formatCurrency(c.claimFiledInr)}` : ''}
              </div>
            </div>
            <Badge variant={TONE[c.stage] ?? 'secondary'} className="shrink-0">{c.stage.replace(/_/g, ' ')}</Badge>
          </div>
        ))}
      </RecordList>
    </div>
  );
}
