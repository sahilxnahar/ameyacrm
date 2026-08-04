'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Ban, ShieldAlert, Plus } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RecordList } from '@/components/shared/record-row';
import { reportVendorDefault, type VendorDefaultInput } from '@/server/actions/labour-billing';

interface Row { id: string; vendor: string; vendorActive: boolean; kind: string; severity: string; note: string | null; reportedOn: string }
const TONE: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = { BLACKLIST: 'destructive', HIGH: 'destructive', MEDIUM: 'warning', LOW: 'secondary' };

export function VendorRegistryView({ counts, rows, vendors }: { counts: { blacklisted: number; total: number }; rows: Row[]; vendors: { id: string; name: string }[] }) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<VendorDefaultInput>({ vendorId: '', kind: 'DELAY', severity: 'MEDIUM' });
  function set<K extends keyof VendorDefaultInput>(k: K, v: VendorDefaultInput[K]) { setForm((f) => ({ ...f, [k]: v })); }
  function submit() {
    if (!form.vendorId) { toast.error('Vendor is required.'); return; }
    setSaving(true);
    reportVendorDefault(form).then((r) => { setSaving(false); if ('error' in r) { toast.error(r.error); return; } toast.success(form.severity === 'BLACKLIST' ? 'Logged — vendor blacklisted & deactivated' : 'Default logged'); setOpen(false); location.reload(); })
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
        <StatCard label="Blacklisted" value={counts.blacklisted} icon={Ban} tone={counts.blacklisted ? 'destructive' : 'default'} />
        <StatCard label="Defaults logged" value={counts.total} icon={ShieldAlert} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Blacklisting a vendor deactivates them across every project immediately.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-1"><Plus className="h-4 w-4" /> Log default</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Log a sub-contractor default</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Vendor *</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.vendorId} onChange={(e) => set('vendorId', e.target.value)}><option value="">Select…</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
              </div>
              <div>
                <Label>Type</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.kind} onChange={(e) => set('kind', e.target.value)}>{['ABANDONMENT', 'QA_FAILURE', 'DELAY', 'FINANCIAL', 'SAFETY'].map((k) => <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>)}</select>
              </div>
              <div>
                <Label>Severity</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.severity} onChange={(e) => set('severity', e.target.value)}>{['LOW', 'MEDIUM', 'HIGH', 'BLACKLIST'].map((s) => <option key={s} value={s}>{s}</option>)}</select>
              </div>
              <div className="col-span-2"><Label>Note</Label><Input value={form.note ?? ''} onChange={(e) => set('note', e.target.value)} placeholder="What happened" /></div>
            </div>
            <div className="mt-2 flex justify-end"><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Log default'}</Button></div>
          </DialogContent>
        </Dialog>
      </div>
      <RecordList empty="No defaults on record. Vendors are clean.">
        {rows.map((d) => (
          <div key={d.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
            <Badge variant="outline" className="shrink-0">{d.kind.replace(/_/g, ' ')}</Badge>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{d.vendor}{!d.vendorActive ? <span className="ml-2 text-xs text-destructive">(deactivated)</span> : ''}</div>
              <div className="truncate text-xs text-muted-foreground">{d.note ?? 'no note'} · {new Date(d.reportedOn).toLocaleDateString('en-IN')}</div>
            </div>
            <Badge variant={TONE[d.severity] ?? 'secondary'} className="shrink-0">{d.severity}</Badge>
          </div>
        ))}
      </RecordList>
    </div>
  );
}
