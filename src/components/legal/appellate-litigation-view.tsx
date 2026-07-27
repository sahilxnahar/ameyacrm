'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Gavel, CalendarClock, Plus } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RecordList } from '@/components/shared/record-row';
import { formatCurrency } from '@/lib/utils/format';
import { saveLitigation, type LitigationInput } from '@/server/actions/legal-disputes';

interface Row { id: string; title: string; forum: string; status: string; caseNo: string | null; counselName: string | null; interimOrder: string | null; disputedInr: number | null; nextHearingOn: string | null; project: string | null }
const FORUMS = ['RERA_AUTHORITY', 'REAT', 'HIGH_COURT', 'SUPREME_COURT'];
const STATUSES = ['FILED', 'ADMITTED', 'INTERIM_ORDER', 'ARGUMENTS', 'RESERVED', 'DISPOSED', 'APPEALED'];
const TONE: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = { DISPOSED: 'secondary', INTERIM_ORDER: 'warning', RESERVED: 'warning', APPEALED: 'destructive' };
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString('en-IN') : '—'; }

export function AppellateLitigationView({ counts, rows, projects }: { counts: { live: number; hearingSoon: number }; rows: Row[]; projects: { id: string; name: string }[] }) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<LitigationInput>({ title: '', forum: 'REAT', status: 'FILED' });
  function set<K extends keyof LitigationInput>(k: K, v: LitigationInput[K]) { setForm((f) => ({ ...f, [k]: v })); }
  function submit() {
    if (!form.title.trim()) { toast.error('Title is required.'); return; }
    setSaving(true);
    saveLitigation(form).then((r) => { setSaving(false); if ('error' in r) { toast.error(r.error); return; } toast.success('Matter saved'); setOpen(false); location.reload(); });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard label="Hearings ≤7d" value={counts.hearingSoon} icon={CalendarClock} tone={counts.hearingSoon ? 'warning' : 'default'} />
        <StatCard label="Live matters" value={counts.live} icon={Gavel} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Assign counsel and a hearing date; the daily sweep flags matters listed within a week.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-1"><Plus className="h-4 w-4" /> New escalation</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New appellate / court matter</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Title *</Label><Input value={form.title} onChange={(e) => set('title', e.target.value)} /></div>
              <div>
                <Label>Forum</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.forum} onChange={(e) => set('forum', e.target.value)}>{FORUMS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select>
              </div>
              <div>
                <Label>Status</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.status} onChange={(e) => set('status', e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select>
              </div>
              <div><Label>Case no.</Label><Input value={form.caseNo ?? ''} onChange={(e) => set('caseNo', e.target.value)} /></div>
              <div><Label>Counsel</Label><Input value={form.counselName ?? ''} onChange={(e) => set('counselName', e.target.value)} /></div>
              <div><Label>Disputed (₹)</Label><Input type="number" value={form.disputedInr ?? ''} onChange={(e) => set('disputedInr', e.target.value ? Number(e.target.value) : null)} /></div>
              <div>
                <Label>Project</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.projectId ?? ''} onChange={(e) => set('projectId', e.target.value || null)}><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              </div>
              <div><Label>Next hearing</Label><Input type="date" value={form.nextHearingOn ?? ''} onChange={(e) => set('nextHearingOn', e.target.value)} /></div>
              <div className="col-span-2"><Label>Interim order</Label><Input value={form.interimOrder ?? ''} onChange={(e) => set('interimOrder', e.target.value)} placeholder="e.g. status quo granted" /></div>
            </div>
            <div className="mt-2 flex justify-end"><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save matter'}</Button></div>
          </DialogContent>
        </Dialog>
      </div>
      <RecordList empty="No appellate matters yet.">
        {rows.map((c) => (
          <div key={c.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
            <Badge variant="outline" className="shrink-0">{c.forum.replace(/_/g, ' ')}</Badge>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{c.title}{c.caseNo ? <span className="ml-2 font-mono text-xs text-muted-foreground">{c.caseNo}</span> : ''}</div>
              <div className="truncate text-xs text-muted-foreground">
                {c.counselName ? `${c.counselName} · ` : ''}{c.disputedInr ? `${formatCurrency(c.disputedInr)} · ` : ''}
                {c.nextHearingOn ? `next ${fmt(c.nextHearingOn)}` : 'no hearing set'}{c.interimOrder ? ` · ${c.interimOrder}` : ''}{c.project ? ` · ${c.project}` : ''}
              </div>
            </div>
            <Badge variant={TONE[c.status] ?? 'secondary'} className="shrink-0">{c.status.replace(/_/g, ' ')}</Badge>
          </div>
        ))}
      </RecordList>
    </div>
  );
}
