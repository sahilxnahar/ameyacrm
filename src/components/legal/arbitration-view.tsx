'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Scale, CalendarClock, Plus } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RecordList } from '@/components/shared/record-row';
import { formatCurrency } from '@/lib/utils/format';
import { saveAdrCase, type AdrInput } from '@/server/actions/legal-disputes';

interface Row { id: string; title: string; refNo: string; stage: string; claimant: string; respondent: string; arbitrator: string | null; claimAmount: number | null; nextHearingOn: string | null; project: string | null; vendor: string | null }
const STAGES = ['NOTICE_ISSUED', 'CONCILIATION', 'ARBITRATOR_APPOINTED', 'PLEADINGS', 'HEARINGS', 'AWARD', 'SETTLED', 'CHALLENGED', 'CLOSED'];
const TONE: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = { SETTLED: 'success', CLOSED: 'secondary', AWARD: 'success', CHALLENGED: 'destructive', HEARINGS: 'warning' };
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString('en-IN') : '—'; }

export function ArbitrationView({ counts, rows, projects, vendors }: { counts: { total: number; hearingSoon: number }; rows: Row[]; projects: { id: string; name: string }[]; vendors: { id: string; name: string }[] }) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<AdrInput>({ title: '', refNo: '', claimant: '', respondent: '', stage: 'NOTICE_ISSUED' });
  function set<K extends keyof AdrInput>(k: K, v: AdrInput[K]) { setForm((f) => ({ ...f, [k]: v })); }
  function submit() {
    if (!form.title.trim() || !form.refNo.trim() || !form.claimant.trim() || !form.respondent.trim()) { toast.error('Title, ref, claimant and respondent are required.'); return; }
    setSaving(true);
    saveAdrCase(form).then((r) => { setSaving(false); if ('error' in r) { toast.error(r.error); return; } toast.success('Case saved'); setOpen(false); location.reload(); })
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
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard label="Hearings ≤7d" value={counts.hearingSoon} icon={CalendarClock} tone={counts.hearingSoon ? 'warning' : 'default'} />
        <StatCard label="Total matters" value={counts.total} icon={Scale} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Set a next-hearing date and the matter surfaces in the daily deadline sweep.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-1"><Plus className="h-4 w-4" /> New matter</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New ADR / arbitration matter</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Title *</Label><Input value={form.title} onChange={(e) => set('title', e.target.value)} /></div>
              <div><Label>Reference no. *</Label><Input value={form.refNo} onChange={(e) => set('refNo', e.target.value)} placeholder="ARB/2026/01" /></div>
              <div>
                <Label>Stage</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.stage} onChange={(e) => set('stage', e.target.value)}>{STAGES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select>
              </div>
              <div><Label>Claimant *</Label><Input value={form.claimant} onChange={(e) => set('claimant', e.target.value)} /></div>
              <div><Label>Respondent *</Label><Input value={form.respondent} onChange={(e) => set('respondent', e.target.value)} /></div>
              <div><Label>Arbitrator</Label><Input value={form.arbitrator ?? ''} onChange={(e) => set('arbitrator', e.target.value)} /></div>
              <div><Label>Claim amount (₹)</Label><Input type="number" value={form.claimAmount ?? ''} onChange={(e) => set('claimAmount', e.target.value ? Number(e.target.value) : null)} /></div>
              <div>
                <Label>Project</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.projectId ?? ''} onChange={(e) => set('projectId', e.target.value || null)}><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              </div>
              <div>
                <Label>Vendor (counterparty)</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.vendorId ?? ''} onChange={(e) => set('vendorId', e.target.value || null)}><option value="">—</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
              </div>
              <div className="col-span-2"><Label>Next hearing</Label><Input type="date" value={form.nextHearingOn ?? ''} onChange={(e) => set('nextHearingOn', e.target.value)} /></div>
            </div>
            <div className="mt-2 flex justify-end"><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save matter'}</Button></div>
          </DialogContent>
        </Dialog>
      </div>
      <RecordList empty="Arbitration and mediation matters live here — the clause invoked, the tribunal, the hearing dates and what was awarded.">
        {rows.map((c) => (
          <div key={c.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{c.title} <span className="font-mono text-xs text-muted-foreground">{c.refNo}</span></div>
              <div className="truncate text-xs text-muted-foreground">
                {c.claimant} v. {c.respondent}{c.arbitrator ? ` · ${c.arbitrator}` : ''}{c.claimAmount ? ` · ${formatCurrency(c.claimAmount)}` : ''}
                {c.nextHearingOn ? ` · next ${fmt(c.nextHearingOn)}` : ''}{c.vendor ? ` · ${c.vendor}` : ''}
              </div>
            </div>
            <Badge variant={TONE[c.stage] ?? 'secondary'} className="shrink-0">{c.stage.replace(/_/g, ' ')}</Badge>
          </div>
        ))}
      </RecordList>
    </div>
  );
}
