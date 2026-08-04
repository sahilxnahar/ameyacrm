'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Stamp, CheckCircle2, Clock, Plus } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RecordList } from '@/components/shared/record-row';
import { formatCurrency } from '@/lib/utils/format';
import { saveEstamp, type EstampInput } from '@/server/actions/legal-disputes';

interface Row { id: string; purpose: string; status: string; dutyInr: number; considerationInr: number | null; certificateNo: string | null; firstParty: string | null; secondParty: string | null; issuedOn: string | null; project: string | null }
const TONE: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = { GENERATED: 'success', USED: 'secondary', REQUESTED: 'warning', CANCELLED: 'secondary', FAILED: 'destructive' };
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString('en-IN') : '—'; }

export function EstampsView({ counts, rows, projects }: { counts: { generated: number; pending: number; duty: number }; rows: Row[]; projects: { id: string; name: string }[] }) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<EstampInput>({ purpose: '', dutyInr: 0 });
  function set<K extends keyof EstampInput>(k: K, v: EstampInput[K]) { setForm((f) => ({ ...f, [k]: v })); }
  function submit() {
    if (!form.purpose.trim()) { toast.error('Purpose is required.'); return; }
    setSaving(true);
    saveEstamp(form).then((r) => { setSaving(false); if ('error' in r) { toast.error(r.error); return; } toast.success('e-Stamp recorded'); setOpen(false); location.reload(); });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Generated" value={counts.generated} icon={CheckCircle2} tone="success" />
        <StatCard label="Awaiting issue" value={counts.pending} icon={Clock} tone={counts.pending ? 'warning' : 'default'} />
        <StatCard label="Total duty" value={formatCurrency(counts.duty)} icon={Stamp} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Records run in manual mode; a live SHCIL webhook fills the certificate number automatically.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-1"><Plus className="h-4 w-4" /> New e-stamp</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Record an e-stamp</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Purpose *</Label><Input value={form.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="Agreement to Sell / Sale Deed" /></div>
              <div><Label>Duty (₹) *</Label><Input type="number" value={form.dutyInr || ''} onChange={(e) => set('dutyInr', Number(e.target.value))} /></div>
              <div><Label>Consideration (₹)</Label><Input type="number" value={form.considerationInr ?? ''} onChange={(e) => set('considerationInr', e.target.value ? Number(e.target.value) : null)} /></div>
              <div><Label>First party</Label><Input value={form.firstParty ?? ''} onChange={(e) => set('firstParty', e.target.value)} /></div>
              <div><Label>Second party</Label><Input value={form.secondParty ?? ''} onChange={(e) => set('secondParty', e.target.value)} /></div>
              <div className="col-span-2">
                <Label>Project</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.projectId ?? ''} onChange={(e) => set('projectId', e.target.value || null)}><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              </div>
            </div>
            <div className="mt-2 flex justify-end"><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></div>
          </DialogContent>
        </Dialog>
      </div>
      <RecordList empty="Stamp duty paid through SHCIL is recorded here against the document it franks, so the certificate and the agreement stay together.">
        {rows.map((e) => (
          <div key={e.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
            <Stamp className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{e.purpose}{e.certificateNo ? <span className="ml-2 font-mono text-xs">{e.certificateNo}</span> : ''}</div>
              <div className="truncate text-xs text-muted-foreground">
                duty {formatCurrency(e.dutyInr)}{e.considerationInr ? ` on ${formatCurrency(e.considerationInr)}` : ''}
                {e.firstParty || e.secondParty ? ` · ${e.firstParty ?? '—'} / ${e.secondParty ?? '—'}` : ''}{e.issuedOn ? ` · issued ${fmt(e.issuedOn)}` : ''}{e.project ? ` · ${e.project}` : ''}
              </div>
            </div>
            <Badge variant={TONE[e.status] ?? 'secondary'} className="shrink-0">{e.status}</Badge>
          </div>
        ))}
      </RecordList>
    </div>
  );
}
