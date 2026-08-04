'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { BadgeCheck, AlertTriangle, Gavel, ShieldQuestion, Plus, Trash2 } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RecordList } from '@/components/shared/record-row';
import { saveTrademark, deleteTrademark, type TrademarkInput } from '@/server/actions/trademarks';

interface Row {
  id: string; mark: string; proprietor: string; niceClass: number; status: string;
  applicationNo: string | null; projectName: string | null; projectId: string | null;
  filedOn: string | null; registeredOn: string | null; renewalDueOn: string | null;
  deadlineOn: string | null; objectionText: string | null; agentName: string | null;
}

const STATUS_TONE: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  REGISTERED: 'success', RENEWAL_DUE: 'warning', OBJECTED: 'destructive', OPPOSED: 'destructive',
  REFUSED: 'destructive', ABANDONED: 'secondary',
};

function fmt(d: string | null): string { return d ? new Date(d).toLocaleDateString('en-IN') : '—'; }
function renewalNote(d: string | null): string {
  if (!d) return '';
  const days = Math.round((new Date(d).getTime() - Date.now()) / 864e5);
  if (days < 0) return ` · renewal overdue ${Math.abs(days)}d`;
  if (days < 200) return ` · renewal in ${days}d`;
  return ` · renews ${fmt(d)}`;
}

export function IpRegistryView({ counts, rows, projects }: {
  counts: { registered: number; dueSoon: number; objected: number; total: number };
  rows: Row[];
  projects: { id: string; name: string }[];
}) {
  // AMH-029 — router.refresh() re-runs the server components and swaps the
  // new HTML in. router.refresh() threw the whole document away: scroll
  // position, open filters, a half-typed field in another panel, and a
  // second of white screen. The server action already calls revalidatePath,
  // so the data is fresh either way.
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<TrademarkInput>({ mark: '', proprietor: '', niceClass: 37, status: 'FILED' });

  function set<K extends keyof TrademarkInput>(k: K, v: TrademarkInput[K]) { setForm((f) => ({ ...f, [k]: v })); }

  function submit() {
    if (!form.mark.trim() || !form.proprietor.trim()) { toast.error('Mark and proprietor are required.'); return; }
    setSaving(true);
    saveTrademark(form).then((r) => {
      setSaving(false);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Trademark saved');
      setOpen(false);
      router.refresh();
    })
      .catch(() => {
        // A rejected server action never reaches .then, so the flag the
        // success path clears was never cleared: the button stayed disabled
        // with a spinner until someone reloaded the page.
        setSaving(false);
        toast.error('Could not reach the server. Nothing was saved — check your connection and try again.');
      });
  }
  function remove(id: string) {
    deleteTrademark(id).then((r) => {
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Deleted'); router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="stat-grid">
        <StatCard label="Registered" value={counts.registered} icon={BadgeCheck} tone="success" />
        <StatCard label="Renewal due" value={counts.dueSoon} icon={AlertTriangle} tone={counts.dueSoon ? 'warning' : 'default'} />
        <StatCard label="Objected / opposed" value={counts.objected} icon={Gavel} tone={counts.objected ? 'destructive' : 'default'} />
        <StatCard label="Total marks" value={counts.total} icon={ShieldQuestion} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Renewals compute automatically as registration + 10 years and flip to “Renewal due” near the deadline.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-1"><Plus className="h-4 w-4" /> Add mark</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Register a trademark</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Mark *</Label><Input value={form.mark} onChange={(e) => set('mark', e.target.value)} placeholder="Nahar Heights" /></div>
              <div className="col-span-2"><Label>Proprietor *</Label><Input value={form.proprietor} onChange={(e) => set('proprietor', e.target.value)} placeholder="Nahar Developers Pvt Ltd" /></div>
              <div><Label>Nice class</Label><Input type="number" value={form.niceClass ?? 37} onChange={(e) => set('niceClass', Number(e.target.value))} /></div>
              <div><Label>Application no.</Label><Input value={form.applicationNo ?? ''} onChange={(e) => set('applicationNo', e.target.value)} placeholder="TM-XXXXXXX" /></div>
              <div>
                <Label>Status</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {['FILED', 'FORMALITIES_CHK', 'EXAMINATION', 'OBJECTED', 'OPPOSED', 'ACCEPTED_ADVERTISED', 'REGISTERED', 'ABANDONED', 'REFUSED'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <div>
                <Label>Project (optional)</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.projectId ?? ''} onChange={(e) => set('projectId', e.target.value || null)}>
                  <option value="">Firm-wide</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><Label>Filed on</Label><Input type="date" value={form.filedOn ?? ''} onChange={(e) => set('filedOn', e.target.value)} /></div>
              <div><Label>Registered on</Label><Input type="date" value={form.registeredOn ?? ''} onChange={(e) => set('registeredOn', e.target.value)} /></div>
              <div className="col-span-2"><Label>Agent / attorney</Label><Input value={form.agentName ?? ''} onChange={(e) => set('agentName', e.target.value)} /></div>
            </div>
            <div className="mt-2 flex justify-end"><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save mark'}</Button></div>
          </DialogContent>
        </Dialog>
      </div>

      <RecordList empty="No trademarks yet. Add your first mark — the 10-year renewal is computed for you.">
        {rows.map((t) => (
          <div key={t.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
            <Badge variant="outline" className="shrink-0">Class {t.niceClass}</Badge>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{t.mark} <span className="font-normal text-muted-foreground">· {t.proprietor}</span></div>
              <div className="truncate text-xs text-muted-foreground">
                {t.applicationNo ? <span className="font-mono">{t.applicationNo}</span> : 'no application no.'}
                {t.projectName ? ` · ${t.projectName}` : ' · firm-wide'}
                {t.registeredOn ? ` · reg ${fmt(t.registeredOn)}` : ''}
                {renewalNote(t.renewalDueOn)}
                {t.agentName ? ` · ${t.agentName}` : ''}
              </div>
            </div>
            <Badge variant={STATUS_TONE[t.status] ?? 'secondary'} className="shrink-0">{t.status.replace(/_/g, ' ')}</Badge>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => remove(t.id)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </RecordList>
    </div>
  );
}
