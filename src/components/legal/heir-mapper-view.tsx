'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Users, FileSignature, Plus } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RecordList } from '@/components/shared/record-row';
import { saveLandowner, type LandownerInput } from '@/server/actions/legal-land';

interface Owner {
  id: string; name: string; relationToRoot: string | null; parentName: string | null; isDeceased: boolean;
  shareNum: number | null; shareDen: number | null; relinquished: boolean; relinquishDeedNo: string | null; project: string | null;
}

export function HeirMapperView({ counts, owners, projects, pickable }: {
  counts: { total: number; relinquished: number };
  owners: Owner[];
  projects: { id: string; name: string }[];
  pickable: { id: string; name: string }[];
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<LandownerInput>({ name: '' });
  function set<K extends keyof LandownerInput>(k: K, v: LandownerInput[K]) { setForm((f) => ({ ...f, [k]: v })); }
  function submit() {
    if (!form.name.trim()) { toast.error('Name is required.'); return; }
    setSaving(true);
    saveLandowner(form).then((r) => { setSaving(false); if ('error' in r) { toast.error(r.error); return; } toast.success('Owner added'); setOpen(false); location.reload(); });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard label="Owners / heirs" value={counts.total} icon={Users} />
        <StatCard label="Relinquished" value={counts.relinquished} icon={FileSignature} tone="success" />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Add the root owner first, then each heir with their parent — the tree builds itself.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-1"><Plus className="h-4 w-4" /> Add owner / heir</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add landowner / heir</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
              <div><Label>Relation</Label><Input value={form.relationToRoot ?? ''} onChange={(e) => set('relationToRoot', e.target.value)} placeholder="son of / widow of" /></div>
              <div>
                <Label>Parent (in tree)</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.parentId ?? ''} onChange={(e) => set('parentId', e.target.value || null)}>
                  <option value="">Root (no parent)</option>{pickable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Project</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.projectId ?? ''} onChange={(e) => set('projectId', e.target.value || null)}>
                  <option value="">Unassigned</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Share num</Label><Input type="number" value={form.shareNum ?? ''} onChange={(e) => set('shareNum', e.target.value ? Number(e.target.value) : null)} /></div>
                <div><Label>Share den</Label><Input type="number" value={form.shareDen ?? ''} onChange={(e) => set('shareDen', e.target.value ? Number(e.target.value) : null)} /></div>
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={form.isDeceased ?? false} onChange={(e) => set('isDeceased', e.target.checked)} /> Deceased</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={form.relinquished ?? false} onChange={(e) => set('relinquished', e.target.checked)} /> Relinquished</label>
              </div>
              <div><Label>Relinquish deed no.</Label><Input value={form.relinquishDeedNo ?? ''} onChange={(e) => set('relinquishDeedNo', e.target.value)} /></div>
            </div>
            <div className="mt-2 flex justify-end"><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Add'}</Button></div>
          </DialogContent>
        </Dialog>
      </div>
      <RecordList empty="No owners yet. Add the root landowner to begin the heir tree.">
        {owners.map((o) => (
          <div key={o.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{o.name}{o.isDeceased ? <span className="ml-2 text-xs text-muted-foreground">(deceased)</span> : ''}</div>
              <div className="truncate text-xs text-muted-foreground">
                {o.relationToRoot ?? 'owner'}{o.parentName ? ` · under ${o.parentName}` : ' · root'}
                {o.shareNum && o.shareDen ? ` · share ${o.shareNum}/${o.shareDen}` : ''}{o.project ? ` · ${o.project}` : ''}
              </div>
            </div>
            {o.relinquished ? <Badge variant="success" className="shrink-0">relinquished{o.relinquishDeedNo ? ` · ${o.relinquishDeedNo}` : ''}</Badge> : <Badge variant="secondary" className="shrink-0">holds share</Badge>}
          </div>
        ))}
      </RecordList>
    </div>
  );
}
