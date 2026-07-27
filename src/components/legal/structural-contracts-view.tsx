'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { HardHat, AlertTriangle, ShieldCheck, Plus, BadgeCheck, Ban } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RecordList } from '@/components/shared/record-row';
import { formatCurrency } from '@/lib/utils/format';
import { saveStructuralContract, certifyEngineerPeriod, type StructuralContractInput } from '@/server/actions/legal-contracts';

interface Cert { period: string; isCleared: boolean }
interface Row {
  id: string; title: string; contractNo: string; status: string; project: string; vendor: string;
  endOn: string | null; defectLiabilityEnd: string | null; value: number | null; certs: Cert[];
}
const TONE: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  ACTIVE: 'success', EXPIRED: 'warning', SUSPENDED: 'warning', TERMINATED: 'destructive', CLOSED: 'secondary',
};
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString('en-IN') : '—'; }
function thisMonth() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }

export function StructuralContractsView({ counts, rows, projects, vendors }: {
  counts: { active: number; expiring: number; total: number };
  rows: Row[];
  projects: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<StructuralContractInput>({ projectId: '', vendorId: '', title: '', contractNo: '', status: 'ACTIVE' });
  function set<K extends keyof StructuralContractInput>(k: K, v: StructuralContractInput[K]) { setForm((f) => ({ ...f, [k]: v })); }

  function submit() {
    if (!form.title.trim() || !form.contractNo.trim() || !form.projectId || !form.vendorId) { toast.error('Project, vendor, title and contract no. are required.'); return; }
    setSaving(true);
    saveStructuralContract(form).then((r) => {
      setSaving(false);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Contract saved'); setOpen(false); location.reload();
    });
  }
  function toggleCert(contractId: string, period: string, next: boolean) {
    certifyEngineerPeriod(contractId, period, next).then((r) => {
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(next ? `Certified ${period}` : `Held ${period}`); location.reload();
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Active contracts" value={counts.active} icon={HardHat} tone="success" />
        <StatCard label="Expiring ≤30d" value={counts.expiring} icon={AlertTriangle} tone={counts.expiring ? 'warning' : 'default'} />
        <StatCard label="Total" value={counts.total} icon={ShieldCheck} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">A period without a cleared engineer certification blocks that vendor’s RA-bill payment automatically.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-1"><Plus className="h-4 w-4" /> New contract</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New structural contract</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Title *</Label><Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="RCC & structural works — Tower A" /></div>
              <div><Label>Contract no. *</Label><Input value={form.contractNo} onChange={(e) => set('contractNo', e.target.value)} placeholder="SC-001" /></div>
              <div><Label>Contract value</Label><Input type="number" value={form.value ?? ''} onChange={(e) => set('value', e.target.value ? Number(e.target.value) : null)} /></div>
              <div>
                <Label>Project *</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.projectId} onChange={(e) => set('projectId', e.target.value)}>
                  <option value="">Select…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Vendor *</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.vendorId} onChange={(e) => set('vendorId', e.target.value)}>
                  <option value="">Select…</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div><Label>Start on</Label><Input type="date" value={form.startOn ?? ''} onChange={(e) => set('startOn', e.target.value)} /></div>
              <div><Label>End on</Label><Input type="date" value={form.endOn ?? ''} onChange={(e) => set('endOn', e.target.value)} /></div>
              <div className="col-span-2"><Label>Defect-liability period end</Label><Input type="date" value={form.defectLiabilityEnd ?? ''} onChange={(e) => set('defectLiabilityEnd', e.target.value)} /></div>
            </div>
            <div className="mt-2 flex justify-end"><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save contract'}</Button></div>
          </DialogContent>
        </Dialog>
      </div>

      <RecordList empty="No structural contracts yet.">
        {rows.map((c) => {
          const m = thisMonth();
          const cleared = c.certs.find((x) => x.period === m)?.isCleared ?? false;
          return (
            <div key={c.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{c.title} <span className="font-mono text-xs text-muted-foreground">{c.contractNo}</span></div>
                <div className="truncate text-xs text-muted-foreground">
                  {c.vendor} · {c.project}{c.value ? ` · ${formatCurrency(c.value)}` : ''}{c.endOn ? ` · ends ${fmt(c.endOn)}` : ''}{c.defectLiabilityEnd ? ` · DLP to ${fmt(c.defectLiabilityEnd)}` : ''}
                </div>
              </div>
              <Button variant={cleared ? 'outline' : 'default'} size="sm" className="shrink-0 gap-1" onClick={() => toggleCert(c.id, m, !cleared)}>
                {cleared ? <><BadgeCheck className="h-3.5 w-3.5" /> {m} certified</> : <><Ban className="h-3.5 w-3.5" /> Certify {m}</>}
              </Button>
              <Badge variant={TONE[c.status] ?? 'secondary'} className="shrink-0">{c.status}</Badge>
            </div>
          );
        })}
      </RecordList>
    </div>
  );
}
