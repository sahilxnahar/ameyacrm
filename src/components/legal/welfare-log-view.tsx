'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { HeartPulse, ShieldAlert, Plus, Droplets, Baby, Cross, Sparkles } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RecordList } from '@/components/shared/record-row';
import { logWelfare, type WelfareInput } from '@/server/actions/welfare';

interface Row { id: string; project: string; category: string; headcount: number | null; note: string | null; loggedOn: string }
interface Gap { projectId: string; project: string; missing: string[] }
const CATS = [
  { key: 'DRINKING_WATER', label: 'Drinking water', icon: Droplets },
  { key: 'MEDICAL_CAMP', label: 'Medical camp', icon: Cross },
  { key: 'CRECHE', label: 'Creche', icon: Baby },
  { key: 'SANITATION', label: 'Sanitation', icon: Sparkles },
];
function catLabel(k: string) { return CATS.find((c) => c.key === k)?.label ?? k.replace(/_/g, ' '); }

export function WelfareLogView({ rows, gaps, gapCount, projects }: { rows: Row[]; gaps: Gap[]; gapCount: number; projects: { id: string; name: string }[] }) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<WelfareInput>({ projectId: '', category: 'DRINKING_WATER' });
  function set<K extends keyof WelfareInput>(k: K, v: WelfareInput[K]) { setForm((f) => ({ ...f, [k]: v })); }
  function submit() {
    if (!form.projectId) { toast.error('Project is required.'); return; }
    setSaving(true);
    logWelfare(form).then((r) => { setSaving(false); if ('error' in r) { toast.error(r.error); return; } toast.success('Welfare logged'); setOpen(false); location.reload(); });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Compliance gaps (this month)" value={gapCount} icon={ShieldAlert} tone={gapCount ? 'destructive' : 'success'} />
        <StatCard label="Logs recorded" value={rows.length} icon={HeartPulse} />
        <StatCard label="Projects with gaps" value={gaps.length} icon={ShieldAlert} tone={gaps.length ? 'warning' : 'success'} />
      </div>

      {gaps.length ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="mb-2 text-sm font-medium text-destructive">This month’s BOCW gaps</div>
          <div className="space-y-1.5">
            {gaps.map((g) => (
              <div key={g.projectId} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{g.project}</span>
                {g.missing.map((c) => <Badge key={c} variant="destructive">{catLabel(c)} missing</Badge>)}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Log each facility monthly with a headcount and, ideally, a photo — that’s the evidence an inspector asks for.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-1"><Plus className="h-4 w-4" /> Log welfare</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Log a welfare facility</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Project *</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.projectId} onChange={(e) => set('projectId', e.target.value)}><option value="">Select…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              </div>
              <div>
                <Label>Facility</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.category} onChange={(e) => set('category', e.target.value)}>{CATS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
              </div>
              <div><Label>Headcount served</Label><Input type="number" value={form.headcount ?? ''} onChange={(e) => set('headcount', e.target.value ? Number(e.target.value) : null)} /></div>
              <div className="col-span-2"><Label>Photo URL</Label><Input value={form.photoUrl ?? ''} onChange={(e) => set('photoUrl', e.target.value)} placeholder="optional" /></div>
              <div className="col-span-2"><Label>Note</Label><Input value={form.note ?? ''} onChange={(e) => set('note', e.target.value)} /></div>
            </div>
            <div className="mt-2 flex justify-end"><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Log'}</Button></div>
          </DialogContent>
        </Dialog>
      </div>

      <RecordList empty="No welfare logs yet. Log drinking water, medical, creche and sanitation each month.">
        {rows.map((w) => (
          <div key={w.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
            <Badge variant="outline" className="shrink-0">{catLabel(w.category)}</Badge>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{w.project}</div>
              <div className="truncate text-xs text-muted-foreground">{w.headcount != null ? `${w.headcount} served · ` : ''}{w.note ?? ''} · {new Date(w.loggedOn).toLocaleDateString('en-IN')}</div>
            </div>
          </div>
        ))}
      </RecordList>
    </div>
  );
}
