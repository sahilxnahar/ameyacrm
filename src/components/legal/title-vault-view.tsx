'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { ScrollText, BadgeCheck, Plus, CircleCheck, Circle } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RecordList } from '@/components/shared/record-row';
import { saveTitleEntry, verifyTitleEntry, type TitleEntryInput } from '@/server/actions/legal-land';

interface Row {
  id: string; kind: string; fromParty: string | null; toParty: string | null; documentNo: string | null;
  registeredOn: string | null; sroOffice: string | null; periodFrom: number | null; periodTo: number | null;
  isVerified: boolean; project: string | null;
}
const KINDS = ['MOTHER_DEED', 'SALE_DEED', 'GIFT_DEED', 'PARTITION_DEED', 'MUTATION_EXTRACT', 'ENCUMBRANCE_CERT', 'RTC_PAHANI', 'CONVERSION_ORDER', 'WILL', 'COURT_DECREE', 'OTHER'];
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString('en-IN') : '—'; }

export function TitleVaultView({ counts, rows, projects }: { counts: { verified: number; total: number }; rows: Row[]; projects: { id: string; name: string }[] }) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<TitleEntryInput>({ kind: 'SALE_DEED' });
  function set<K extends keyof TitleEntryInput>(k: K, v: TitleEntryInput[K]) { setForm((f) => ({ ...f, [k]: v })); }
  function submit() {
    setSaving(true);
    saveTitleEntry(form).then((r) => { setSaving(false); if ('error' in r) { toast.error(r.error); return; } toast.success('Entry added'); setOpen(false); location.reload(); });
  }
  function verify(id: string, next: boolean) { verifyTitleEntry(id, next).then((r) => { if ('error' in r) { toast.error(r.error); return; } location.reload(); }); }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard label="Verified links" value={counts.verified} icon={BadgeCheck} tone="success" />
        <StatCard label="Total documents" value={counts.total} icon={ScrollText} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Build the chain oldest-first; verify each link as you confirm it against the original.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-1"><Plus className="h-4 w-4" /> Add document</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add a link document</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kind</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.kind} onChange={(e) => set('kind', e.target.value)}>
                  {KINDS.map((k) => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <Label>Project</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.projectId ?? ''} onChange={(e) => set('projectId', e.target.value || null)}>
                  <option value="">Unassigned</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><Label>From party</Label><Input value={form.fromParty ?? ''} onChange={(e) => set('fromParty', e.target.value)} /></div>
              <div><Label>To party</Label><Input value={form.toParty ?? ''} onChange={(e) => set('toParty', e.target.value)} /></div>
              <div><Label>Document no.</Label><Input value={form.documentNo ?? ''} onChange={(e) => set('documentNo', e.target.value)} /></div>
              <div><Label>Registered on</Label><Input type="date" value={form.registeredOn ?? ''} onChange={(e) => set('registeredOn', e.target.value)} /></div>
              <div><Label>SRO office</Label><Input value={form.sroOffice ?? ''} onChange={(e) => set('sroOffice', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Yr from</Label><Input type="number" value={form.periodFrom ?? ''} onChange={(e) => set('periodFrom', e.target.value ? Number(e.target.value) : null)} /></div>
                <div><Label>Yr to</Label><Input type="number" value={form.periodTo ?? ''} onChange={(e) => set('periodTo', e.target.value ? Number(e.target.value) : null)} /></div>
              </div>
            </div>
            <div className="mt-2 flex justify-end"><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Add'}</Button></div>
          </DialogContent>
        </Dialog>
      </div>
      <RecordList empty="No title documents yet. Start with the mother deed and work forward.">
        {rows.map((t) => (
          <div key={t.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
            <Badge variant="outline" className="shrink-0">{t.kind.replace(/_/g, ' ')}</Badge>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{t.fromParty ?? '—'} → {t.toParty ?? '—'}</div>
              <div className="truncate text-xs text-muted-foreground">
                {t.documentNo ? <span className="font-mono">{t.documentNo}</span> : 'no doc no.'}
                {t.registeredOn ? ` · reg ${fmt(t.registeredOn)}` : ''}{t.sroOffice ? ` · ${t.sroOffice}` : ''}
                {t.periodFrom || t.periodTo ? ` · ${t.periodFrom ?? '?'}–${t.periodTo ?? '?'}` : ''}{t.project ? ` · ${t.project}` : ''}
              </div>
            </div>
            <Button variant="ghost" size="sm" className="shrink-0 gap-1" onClick={() => verify(t.id, !t.isVerified)}>
              {t.isVerified ? <><CircleCheck className="h-4 w-4 text-success" /> Verified</> : <><Circle className="h-4 w-4 text-muted-foreground" /> Verify</>}
            </Button>
          </div>
        ))}
      </RecordList>
    </div>
  );
}
