'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Building2, ShieldAlert, BadgeCheck, Plus } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RecordList } from '@/components/shared/record-row';
import { savePlanSanction, updateBuiltFar, type PlanSanctionInput } from '@/server/actions/plan-sanction';

interface Row {
  id: string; project: string; authority: string; sanctionNo: string | null;
  sanctionedFar: number; builtFar: number; deviationPct: number;
  ocApplied: boolean; ocReceived: boolean; ocNumber: string | null; risk: 'OK' | 'WATCH' | 'AT_RISK';
}
const RISK_TONE: Record<string, 'success' | 'warning' | 'destructive'> = { OK: 'success', WATCH: 'warning', AT_RISK: 'destructive' };

export function PlanSanctionView({ counts, rows, projects }: { counts: { atRisk: number; ocDone: number; total: number }; rows: Row[]; projects: { id: string; name: string }[] }) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<PlanSanctionInput>({ projectId: '', authority: 'BBMP', sanctionedFar: 0, builtFar: 0 });
  function set<K extends keyof PlanSanctionInput>(k: K, v: PlanSanctionInput[K]) { setForm((f) => ({ ...f, [k]: v })); }
  function submit() {
    if (!form.projectId || !(form.sanctionedFar > 0)) { toast.error('Project and a sanctioned FAR are required.'); return; }
    setSaving(true);
    savePlanSanction(form).then((r) => { setSaving(false); if ('error' in r) { toast.error(r.error); return; } toast.success('Sanction saved'); setOpen(false); location.reload(); });
  }
  function bump(id: string, current: number) {
    const v = prompt('Update as-built FAR:', String(current)); if (v == null) return;
    updateBuiltFar(id, Number(v)).then((r) => { if ('error' in r) { toast.error(r.error); return; } toast.success('As-built FAR updated'); location.reload(); });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="OC at risk" value={counts.atRisk} icon={ShieldAlert} tone={counts.atRisk ? 'destructive' : 'default'} />
        <StatCard label="OC received" value={counts.ocDone} icon={BadgeCheck} tone="success" />
        <StatCard label="Sanctions tracked" value={counts.total} icon={Building2} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Update the as-built FAR as slabs are cast — the deviation and OC risk recompute instantly.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-1"><Plus className="h-4 w-4" /> New sanction</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New plan sanction</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Project *</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.projectId} onChange={(e) => set('projectId', e.target.value)}><option value="">Select…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              </div>
              <div>
                <Label>Authority</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.authority} onChange={(e) => set('authority', e.target.value)}>{['BBMP', 'BDA', 'BMRDA'].map((a) => <option key={a} value={a}>{a}</option>)}</select>
              </div>
              <div><Label>Sanction no.</Label><Input value={form.sanctionNo ?? ''} onChange={(e) => set('sanctionNo', e.target.value)} /></div>
              <div><Label>Sanctioned FAR *</Label><Input type="number" step="0.001" value={form.sanctionedFar || ''} onChange={(e) => set('sanctionedFar', Number(e.target.value))} /></div>
              <div><Label>Built FAR (so far)</Label><Input type="number" step="0.001" value={form.builtFar || ''} onChange={(e) => set('builtFar', Number(e.target.value))} /></div>
              <div><Label>Sanctioned area (sqft)</Label><Input type="number" value={form.sanctionedArea ?? ''} onChange={(e) => set('sanctionedArea', e.target.value ? Number(e.target.value) : null)} /></div>
              <div><Label>Built area (sqft)</Label><Input type="number" value={form.builtArea ?? ''} onChange={(e) => set('builtArea', e.target.value ? Number(e.target.value) : null)} /></div>
              <div><Label>Sanctioned on</Label><Input type="date" value={form.sanctionedOn ?? ''} onChange={(e) => set('sanctionedOn', e.target.value)} /></div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={form.ocApplied ?? false} onChange={(e) => set('ocApplied', e.target.checked)} /> OC applied</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={form.ocReceived ?? false} onChange={(e) => set('ocReceived', e.target.checked)} /> OC received</label>
              </div>
            </div>
            <div className="mt-2 flex justify-end"><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></div>
          </DialogContent>
        </Dialog>
      </div>
      <RecordList empty="Track a BBMP or BDA plan sanction from application to release, with the FAR consumed against what was approved.">
        {rows.map((s) => (
          <div key={s.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
            <Badge variant="outline" className="shrink-0">{s.authority}</Badge>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{s.project}{s.sanctionNo ? <span className="ml-2 font-mono text-xs text-muted-foreground">{s.sanctionNo}</span> : ''}</div>
              <div className="truncate text-xs text-muted-foreground">
                FAR {s.builtFar} / {s.sanctionedFar} · {s.deviationPct > 0 ? `+${s.deviationPct}% over` : `${s.deviationPct}%`}
                {s.ocReceived ? ` · OC ${s.ocNumber ?? 'received'}` : s.ocApplied ? ' · OC applied' : ''}
              </div>
            </div>
            <Button variant="ghost" size="sm" className="shrink-0" onClick={() => bump(s.id, s.builtFar)}>Update FAR</Button>
            <Badge variant={RISK_TONE[s.risk]} className="shrink-0">{s.risk === 'AT_RISK' ? 'OC at risk' : s.risk === 'WATCH' ? 'watch' : 'OK'}</Badge>
          </div>
        ))}
      </RecordList>
    </div>
  );
}
