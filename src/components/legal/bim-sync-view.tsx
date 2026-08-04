'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Box, Plus, CheckCircle2, Zap, ListPlus } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RecordList } from '@/components/shared/record-row';
import { saveBimModel, saveBimPhase, completeBimPhase, type BimModelInput, type BimPhaseInput } from '@/server/actions/bim';

interface Phase { id: string; label: string; plannedOn: string | null; actualOn: string | null; triggersDemand: boolean; linked: boolean }
interface Model { id: string; name: string; project: string; discipline: string | null; progressPct: number; urn: string | null; phases: Phase[] }
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString('en-IN') : '—'; }

export function BimSyncView({ models, projects, milestones }: { models: Model[]; projects: { id: string; name: string }[]; milestones: { id: string; label: string; amount: number }[] }) {
  // AMH-029 — router.refresh() re-runs the server components and swaps the
  // new HTML in. router.refresh() threw the whole document away: scroll
  // position, open filters, a half-typed field in another panel, and a
  // second of white screen. The server action already calls revalidatePath,
  // so the data is fresh either way.
  const router = useRouter();
  const [openModel, setOpenModel] = React.useState(false);
  const [phaseFor, setPhaseFor] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [mForm, setMForm] = React.useState<BimModelInput>({ projectId: '', name: '', progressPct: 0 });
  const [pForm, setPForm] = React.useState<BimPhaseInput>({ bimModelId: '', label: '', triggersDemand: false });

  const completedPhases = models.reduce((n, m) => n + m.phases.filter((p) => p.actualOn).length, 0);
  const totalPhases = models.reduce((n, m) => n + m.phases.length, 0);

  function submitModel() {
    if (!mForm.projectId || !mForm.name.trim()) { toast.error('Project and name required.'); return; }
    setSaving(true);
    saveBimModel(mForm).then((r) => { setSaving(false); if ('error' in r) { toast.error(r.error); return; } toast.success('Model added'); setOpenModel(false); router.refresh(); })
      .catch(() => {
        // A rejected server action never reaches .then, so the flag the
        // success path clears was never cleared: the button stayed disabled
        // with a spinner until someone reloaded the page.
        setSaving(false);
        toast.error('Could not reach the server. Nothing was saved — check your connection and try again.');
      });
  }
  function submitPhase() {
    if (!pForm.label.trim()) { toast.error('Phase label required.'); return; }
    setSaving(true);
    saveBimPhase(pForm).then((r) => { setSaving(false); if ('error' in r) { toast.error(r.error); return; } toast.success('Phase added'); setPhaseFor(null); router.refresh(); })
      .catch(() => {
        // A rejected server action never reaches .then, so the flag the
        // success path clears was never cleared: the button stayed disabled
        // with a spinner until someone reloaded the page.
        setSaving(false);
        toast.error('Could not reach the server. Nothing was saved — check your connection and try again.');
      });
  }
  function complete(id: string) {
    completeBimPhase(id).then((r) => { if ('error' in r) { toast.error(r.error); return; } toast.success(r.triggered ? 'Phase complete → demand triggered' : 'Phase complete'); router.refresh(); });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Models" value={models.length} icon={Box} />
        <StatCard label="Phases complete" value={`${completedPhases}/${totalPhases}`} icon={CheckCircle2} tone="success" />
        <StatCard label="Demand-linked phases" value={models.reduce((n, m) => n + m.phases.filter((p) => p.triggersDemand).length, 0)} icon={Zap} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">A demand-linked phase, when marked complete, brings its buyer milestone due so the dunning engine raises the demand.</p>
        <Dialog open={openModel} onOpenChange={setOpenModel}>
          <DialogTrigger asChild><Button className="gap-1"><Plus className="h-4 w-4" /> Add model</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add a BIM model</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Project *</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={mForm.projectId} onChange={(e) => setMForm((f) => ({ ...f, projectId: e.target.value }))}><option value="">Select…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              </div>
              <div className="col-span-2"><Label>Model name *</Label><Input value={mForm.name} onChange={(e) => setMForm((f) => ({ ...f, name: e.target.value }))} placeholder="Tower A — structural" /></div>
              <div>
                <Label>Discipline</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={mForm.discipline ?? ''} onChange={(e) => setMForm((f) => ({ ...f, discipline: e.target.value || null }))}><option value="">—</option>{['ARCH', 'STRUCT', 'MEP'].map((d) => <option key={d} value={d}>{d}</option>)}</select>
              </div>
              <div><Label>Progress %</Label><Input type="number" value={mForm.progressPct ?? 0} onChange={(e) => setMForm((f) => ({ ...f, progressPct: Number(e.target.value) }))} /></div>
              <div className="col-span-2"><Label>Viewer URN (APS/Forge)</Label><Input value={mForm.urn ?? ''} onChange={(e) => setMForm((f) => ({ ...f, urn: e.target.value }))} placeholder="optional" /></div>
            </div>
            <div className="mt-2 flex justify-end"><Button onClick={submitModel} disabled={saving}>{saving ? 'Saving…' : 'Add model'}</Button></div>
          </DialogContent>
        </Dialog>
      </div>

      {models.map((m) => (
        <div key={m.id} className="rounded-lg border">
          <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5">
            <div>
              <div className="text-sm font-medium">{m.name} <span className="text-xs text-muted-foreground">{m.project}{m.discipline ? ` · ${m.discipline}` : ''}</span></div>
              <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-muted"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, m.progressPct)}%` }} /></div>
            </div>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => { setPForm({ bimModelId: m.id, label: '', triggersDemand: false }); setPhaseFor(m.id); }}><ListPlus className="h-4 w-4" /> Add phase</Button>
          </div>
          <RecordList empty="Link a construction phase to its BIM element set here, so the 4D model shows what should be built by when.">
            {m.phases.map((p) => (
              <div key={p.id} className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{p.label}</div>
                  <div className="truncate text-xs text-muted-foreground">planned {fmt(p.plannedOn)}{p.actualOn ? ` · done ${fmt(p.actualOn)}` : ''}{p.triggersDemand && p.linked ? ' · triggers demand' : ''}</div>
                </div>
                {p.actualOn ? <Badge variant="success" className="shrink-0">complete</Badge> : <Button size="sm" className="shrink-0 gap-1" onClick={() => complete(p.id)}><CheckCircle2 className="h-4 w-4" /> Complete</Button>}
              </div>
            ))}
          </RecordList>
        </div>
      ))}

      <Dialog open={!!phaseFor} onOpenChange={(v) => !v && setPhaseFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add a construction phase</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Label *</Label><Input value={pForm.label} onChange={(e) => setPForm((f) => ({ ...f, label: e.target.value }))} placeholder="Tower A — 5th slab" /></div>
            <div><Label>Planned on</Label><Input type="date" value={pForm.plannedOn ?? ''} onChange={(e) => setPForm((f) => ({ ...f, plannedOn: e.target.value }))} /></div>
            <div>
              <Label>Link buyer milestone</Label>
              <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={pForm.milestoneId ?? ''} onChange={(e) => setPForm((f) => ({ ...f, milestoneId: e.target.value || null }))}><option value="">— none —</option>{milestones.map((ms) => <option key={ms.id} value={ms.id}>{ms.label}</option>)}</select>
            </div>
            <div className="col-span-2 flex items-center gap-2"><input id="trig" type="checkbox" className="h-4 w-4" checked={pForm.triggersDemand ?? false} onChange={(e) => setPForm((f) => ({ ...f, triggersDemand: e.target.checked }))} /><Label htmlFor="trig">Completing this phase triggers the demand</Label></div>
          </div>
          <div className="mt-2 flex justify-end"><Button onClick={submitPhase} disabled={saving}>{saving ? 'Saving…' : 'Add phase'}</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
