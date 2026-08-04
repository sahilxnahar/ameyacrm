'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { FileText, BadgeCheck, Plus } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RecordList } from '@/components/shared/record-row';
import { saveKhata, type KhataInput } from '@/server/actions/finance-tax';

interface Row { id: string; khataType: string; pid: string | null; khataNo: string | null; assessmentNo: string | null; ownerName: string | null; lastEcOn: string | null; ecClear: boolean; project: string | null }
const TONE: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = { A_KHATA: 'success', B_KHATA: 'warning', E_KHATA: 'secondary', NONE: 'secondary' };
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString('en-IN') : '—'; }

export function KhataVaultView({ counts, rows, projects }: { counts: { total: number; aKhata: number; ecClear: number }; rows: Row[]; projects: { id: string; name: string }[] }) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<KhataInput>({ khataType: 'A_KHATA', ecClear: false });
  function set<K extends keyof KhataInput>(k: K, v: KhataInput[K]) { setForm((f) => ({ ...f, [k]: v })); }
  function submit() {
    setSaving(true);
    saveKhata(form).then((r) => { setSaving(false); if ('error' in r) { toast.error(r.error); return; } toast.success('Khata saved'); setOpen(false); location.reload(); })
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
        <StatCard label="A-Khata" value={counts.aKhata} icon={BadgeCheck} tone="success" />
        <StatCard label="EC clear" value={counts.ecClear} icon={BadgeCheck} tone="success" />
        <StatCard label="Total records" value={counts.total} icon={FileText} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">A-Khata is fully municipalised and loanable; B-Khata is a step short — track both, per PID.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-1"><Plus className="h-4 w-4" /> Add khata</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add khata / EC record</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Khata type</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.khataType} onChange={(e) => set('khataType', e.target.value)}>
                  {['A_KHATA', 'B_KHATA', 'E_KHATA', 'NONE'].map((s) => <option key={s} value={s}>{s.replace(/_/g, '-')}</option>)}
                </select>
              </div>
              <div>
                <Label>Project</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.projectId ?? ''} onChange={(e) => set('projectId', e.target.value || null)}><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              </div>
              <div><Label>PID (BBMP)</Label><Input value={form.pid ?? ''} onChange={(e) => set('pid', e.target.value)} /></div>
              <div><Label>Khata no.</Label><Input value={form.khataNo ?? ''} onChange={(e) => set('khataNo', e.target.value)} /></div>
              <div><Label>Assessment no.</Label><Input value={form.assessmentNo ?? ''} onChange={(e) => set('assessmentNo', e.target.value)} /></div>
              <div><Label>Owner name</Label><Input value={form.ownerName ?? ''} onChange={(e) => set('ownerName', e.target.value)} /></div>
              <div><Label>Last EC on</Label><Input type="date" value={form.lastEcOn ?? ''} onChange={(e) => set('lastEcOn', e.target.value)} /></div>
              <div className="flex items-end gap-2"><input id="ec" type="checkbox" className="h-4 w-4" checked={form.ecClear ?? false} onChange={(e) => set('ecClear', e.target.checked)} /><Label htmlFor="ec">EC clear (nil encumbrance)</Label></div>
            </div>
            <div className="mt-2 flex justify-end"><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></div>
          </DialogContent>
        </Dialog>
      </div>
      <RecordList empty="A khata and an up-to-date encumbrance certificate are what a buyer's bank asks for first. Keep both here per unit.">
        {rows.map((k) => (
          <div key={k.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
            <Badge variant={TONE[k.khataType] ?? 'secondary'} className="shrink-0">{k.khataType.replace(/_/g, '-')}</Badge>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{k.ownerName ?? '—'}{k.pid ? <span className="ml-2 font-mono text-xs text-muted-foreground">PID {k.pid}</span> : ''}</div>
              <div className="truncate text-xs text-muted-foreground">
                {k.khataNo ? `Khata ${k.khataNo} · ` : ''}{k.assessmentNo ? `Assmt ${k.assessmentNo} · ` : ''}{k.project ? `${k.project} · ` : ''}EC {k.ecClear ? `clear (${fmt(k.lastEcOn)})` : 'pending'}
              </div>
            </div>
            {k.ecClear ? <Badge variant="success" className="shrink-0">EC clear</Badge> : <Badge variant="warning" className="shrink-0">EC pending</Badge>}
          </div>
        ))}
      </RecordList>
    </div>
  );
}
