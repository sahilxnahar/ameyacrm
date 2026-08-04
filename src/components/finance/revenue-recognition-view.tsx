'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { TrendingUp, Percent, Plus } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RecordList } from '@/components/shared/record-row';
import { formatCurrency } from '@/lib/utils/format';
import { computePocm } from '@/lib/finance/pocm';
import { snapshotPocmRevenue } from '@/server/actions/finance-tax';

interface Row { id: string; project: string; period: string; pocmPercent: number; revenueToDate: number; revenueThisPeriod: number; costToDate: number; totalEstCost: number }
function thisMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

export function RevenueRecognitionView({ rows, projects }: { rows: Row[]; projects: { id: string; name: string }[] }) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({ projectId: '', period: thisMonth(), costToDate: 0, totalEstCost: 0, totalContractVal: 0 });
  const preview = computePocm({ costToDate: Number(form.costToDate), totalEstCost: Number(form.totalEstCost), totalContractVal: Number(form.totalContractVal) });

  const latestToDate = rows[0]?.revenueToDate ?? 0;
  const avgPocm = rows.length ? Math.round(rows.reduce((n, r) => n + r.pocmPercent, 0) / rows.length) : 0;

  function submit() {
    if (!form.projectId || !/^\d{4}-\d{2}$/.test(form.period)) { toast.error('Project and a YYYY-MM period are required.'); return; }
    setSaving(true);
    snapshotPocmRevenue(form).then((r) => { setSaving(false); if ('error' in r) { toast.error(r.error); return; } toast.success('Revenue snapshot saved'); setOpen(false); location.reload(); })
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
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Latest revenue to date" value={formatCurrency(latestToDate)} icon={TrendingUp} tone="success" />
        <StatCard label="Avg completion" value={`${avgPocm}%`} icon={Percent} />
        <StatCard label="Snapshots" value={rows.length} icon={TrendingUp} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Revenue = (cost to date ÷ total estimated cost) × contract value, clamped at 100%.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-1"><Plus className="h-4 w-4" /> New snapshot</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Snapshot POCM revenue</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Project *</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}><option value="">Select…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              </div>
              <div><Label>Period (YYYY-MM)</Label><Input value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))} /></div>
              <div><Label>Cost to date (₹)</Label><Input type="number" value={form.costToDate || ''} onChange={(e) => setForm((f) => ({ ...f, costToDate: Number(e.target.value) }))} /></div>
              <div><Label>Total est. cost (₹)</Label><Input type="number" value={form.totalEstCost || ''} onChange={(e) => setForm((f) => ({ ...f, totalEstCost: Number(e.target.value) }))} /></div>
              <div><Label>Contract value (₹)</Label><Input type="number" value={form.totalContractVal || ''} onChange={(e) => setForm((f) => ({ ...f, totalContractVal: Number(e.target.value) }))} /></div>
              <div className="col-span-2 rounded-md bg-muted/40 p-2 text-sm">Preview: <b>{preview.pocmPercent}%</b> complete · revenue to date <b>{formatCurrency(preview.revenueToDate)}</b></div>
            </div>
            <div className="mt-2 flex justify-end"><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save snapshot'}</Button></div>
          </DialogContent>
        </Dialog>
      </div>
      <RecordList empty="Revenue recognised under IND-AS 115 appears here once a project has costs booked against it. Run a snapshot at period close to lock the percentage complete.">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{r.project} <span className="text-xs text-muted-foreground">{r.period}</span></div>
              <div className="truncate text-xs text-muted-foreground">{r.pocmPercent}% complete · to date {formatCurrency(r.revenueToDate)} · this period {formatCurrency(r.revenueThisPeriod)}</div>
            </div>
            <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, r.pocmPercent)}%` }} /></div>
          </div>
        ))}
      </RecordList>
    </div>
  );
}
