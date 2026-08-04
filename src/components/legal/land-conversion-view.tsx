'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Map, CheckCircle2, Plus } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RecordList } from '@/components/shared/record-row';
import { formatCurrency } from '@/lib/utils/format';
import { saveLandConversion, type LandConversionInput } from '@/server/actions/legal-land';

interface Row {
  id: string; surveyNo: string; village: string | null; taluk: string | null; stage: string;
  extentAcres: number | null; dcOrderNo: string | null; conversionFee: number | null;
  appliedOn: string | null; orderOn: string | null; project: string | null;
}
const STAGES = ['APPLIED', 'RTC_VERIFIED', 'DC_SCRUTINY', 'FEE_DEMANDED', 'FEE_PAID', 'DC_ORDER_ISSUED', 'KHATA_UPDATED', 'REJECTED'];
const TONE: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  KHATA_UPDATED: 'success', DC_ORDER_ISSUED: 'success', REJECTED: 'destructive', FEE_DEMANDED: 'warning',
};
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString('en-IN') : '—'; }

export function LandConversionView({ counts, rows, projects }: { counts: { done: number; total: number }; rows: Row[]; projects: { id: string; name: string }[] }) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<LandConversionInput>({ surveyNo: '', stage: 'APPLIED' });
  function set<K extends keyof LandConversionInput>(k: K, v: LandConversionInput[K]) { setForm((f) => ({ ...f, [k]: v })); }
  function submit() {
    if (!form.surveyNo.trim()) { toast.error('Survey number is required.'); return; }
    setSaving(true);
    saveLandConversion(form).then((r) => { setSaving(false); if ('error' in r) { toast.error(r.error); return; } toast.success('Saved'); setOpen(false); location.reload(); })
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
        <StatCard label="Converted" value={counts.done} icon={CheckCircle2} tone="success" />
        <StatCard label="Total parcels" value={counts.total} icon={Map} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Move a parcel through the DC workflow; the fee links to a payment voucher when demanded.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-1"><Plus className="h-4 w-4" /> New parcel</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New conversion application</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Survey no. *</Label><Input value={form.surveyNo} onChange={(e) => set('surveyNo', e.target.value)} placeholder="123/2" /></div>
              <div><Label>Extent (acres)</Label><Input type="number" step="0.0001" value={form.extentAcres ?? ''} onChange={(e) => set('extentAcres', e.target.value ? Number(e.target.value) : null)} /></div>
              <div><Label>Village</Label><Input value={form.village ?? ''} onChange={(e) => set('village', e.target.value)} /></div>
              <div><Label>Taluk</Label><Input value={form.taluk ?? ''} onChange={(e) => set('taluk', e.target.value)} /></div>
              <div>
                <Label>Stage</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.stage} onChange={(e) => set('stage', e.target.value)}>
                  {STAGES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <Label>Project</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.projectId ?? ''} onChange={(e) => set('projectId', e.target.value || null)}>
                  <option value="">Unassigned</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><Label>Conversion fee (₹)</Label><Input type="number" value={form.conversionFee ?? ''} onChange={(e) => set('conversionFee', e.target.value ? Number(e.target.value) : null)} /></div>
              <div><Label>DC order no.</Label><Input value={form.dcOrderNo ?? ''} onChange={(e) => set('dcOrderNo', e.target.value)} /></div>
              <div><Label>Applied on</Label><Input type="date" value={form.appliedOn ?? ''} onChange={(e) => set('appliedOn', e.target.value)} /></div>
              <div><Label>Order on</Label><Input type="date" value={form.orderOn ?? ''} onChange={(e) => set('orderOn', e.target.value)} /></div>
            </div>
            <div className="mt-2 flex justify-end"><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></div>
          </DialogContent>
        </Dialog>
      </div>
      <RecordList empty="Agricultural land needs a DC conversion order before it can be built on. Track the application, the fee and the order number here.">
        {rows.map((c) => (
          <div key={c.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
            <Badge variant="outline" className="shrink-0">Sy {c.surveyNo}</Badge>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{c.village ?? '—'}{c.taluk ? `, ${c.taluk}` : ''}{c.extentAcres ? ` · ${c.extentAcres} ac` : ''}</div>
              <div className="truncate text-xs text-muted-foreground">
                {c.project ? `${c.project} · ` : ''}{c.dcOrderNo ? `DC ${c.dcOrderNo} · ` : ''}
                {c.conversionFee ? `fee ${formatCurrency(c.conversionFee)} · ` : ''}{c.appliedOn ? `applied ${fmt(c.appliedOn)}` : ''}{c.orderOn ? ` · order ${fmt(c.orderOn)}` : ''}
              </div>
            </div>
            <Badge variant={TONE[c.stage] ?? 'secondary'} className="shrink-0">{c.stage.replace(/_/g, ' ')}</Badge>
          </div>
        ))}
      </RecordList>
    </div>
  );
}
