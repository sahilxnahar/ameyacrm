'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Globe2, BadgeCheck, AlertTriangle, Plus, IndianRupee } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RecordList } from '@/components/shared/record-row';
import { formatCurrency } from '@/lib/utils/format';
import { saveNriProfile, addForeignRemittance, type NriProfileInput } from '@/server/actions/legal-disputes';

interface Remit { id: string; amountForeign: number; currency: string; amountInr: number; receivedOn: string | null; reportDueOn: string | null; reportedOn: string | null }
interface Row { id: string; taxResidency: string; status: string; femaCategory: string | null; fatcaDeclared: boolean; fatcaFormRef: string | null; remittances: Remit[] }
const TONE: Record<string, 'success' | 'warning' | 'destructive' | 'secondary'> = { VERIFIED: 'success', SUBMITTED: 'warning', PENDING: 'secondary', REJECTED: 'destructive' };
function fmt(d: string | null) { return d ? new Date(d).toLocaleDateString('en-IN') : '—'; }

export function NriGatewayView({ counts, rows }: { counts: { total: number; verified: number; femaDue: number }; rows: Row[] }) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState<NriProfileInput>({ taxResidency: '', status: 'PENDING', fatcaDeclared: false });
  function set<K extends keyof NriProfileInput>(k: K, v: NriProfileInput[K]) { setForm((f) => ({ ...f, [k]: v })); }
  function submit() {
    if (!form.taxResidency.trim()) { toast.error('Tax residency is required.'); return; }
    setSaving(true);
    saveNriProfile(form).then((r) => { setSaving(false); if ('error' in r) { toast.error(r.error); return; } toast.success('Profile saved'); setOpen(false); location.reload(); });
  }
  function addRemit(profileId: string) {
    const amt = prompt('Foreign amount (e.g. 50000):'); if (!amt) return;
    const cur = prompt('Currency (USD/GBP/AED):', 'USD') ?? 'USD';
    const inr = prompt('INR credited:'); if (!inr) return;
    addForeignRemittance(profileId, Number(amt), cur, Number(inr)).then((r) => { if ('error' in r) { toast.error(r.error); return; } toast.success('Remittance logged — 90-day FEMA clock started'); location.reload(); });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="NRI profiles" value={counts.total} icon={Globe2} />
        <StatCard label="KYC verified" value={counts.verified} icon={BadgeCheck} tone="success" />
        <StatCard label="FEMA report ≤30d" value={counts.femaDue} icon={AlertTriangle} tone={counts.femaDue ? 'warning' : 'default'} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Each remittance starts a 90-day FEMA reporting clock, watched by the daily cron.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-1"><Plus className="h-4 w-4" /> New NRI profile</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New NRI compliance profile</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tax residency *</Label><Input value={form.taxResidency} onChange={(e) => set('taxResidency', e.target.value)} placeholder="United States" /></div>
              <div><Label>FEMA category</Label><Input value={form.femaCategory ?? ''} onChange={(e) => set('femaCategory', e.target.value)} placeholder="NRE / NRO / FCNR" /></div>
              <div>
                <Label>Status</Label>
                <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {['PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div><Label>FATCA form ref</Label><Input value={form.fatcaFormRef ?? ''} onChange={(e) => set('fatcaFormRef', e.target.value)} placeholder="W-8BEN ref" /></div>
              <div className="col-span-2 flex items-center gap-2"><input id="fatca" type="checkbox" className="h-4 w-4" checked={form.fatcaDeclared ?? false} onChange={(e) => set('fatcaDeclared', e.target.checked)} /><Label htmlFor="fatca">FATCA declared</Label></div>
              <div className="col-span-2"><Label>Overseas address</Label><Input value={form.overseasAddress ?? ''} onChange={(e) => set('overseasAddress', e.target.value)} /></div>
            </div>
            <div className="mt-2 flex justify-end"><Button onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</Button></div>
          </DialogContent>
        </Dialog>
      </div>
      <RecordList empty="A buyer marked as an NRI gets a profile here: repatriation route, FEMA declaration and the KYC set their bank will ask for.">
        {rows.map((p) => {
          const due = p.remittances.find((r) => !r.reportedOn && r.reportDueOn && new Date(r.reportDueOn) < new Date(Date.now() + 30 * 864e5));
          return (
            <div key={p.id} className="flex items-center gap-3 border-b px-3 py-2.5 last:border-b-0">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.taxResidency}{p.femaCategory ? ` · ${p.femaCategory}` : ''}{p.fatcaDeclared ? ' · FATCA ✓' : ''}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {p.remittances.length} remittance{p.remittances.length !== 1 ? 's' : ''}
                  {p.remittances[0] ? ` · last ${formatCurrency(p.remittances[0].amountInr)} on ${fmt(p.remittances[0].receivedOn)}` : ''}
                  {due ? ` · ⚠ FEMA report by ${fmt(due.reportDueOn)}` : ''}
                </div>
              </div>
              <Button variant="outline" size="sm" className="shrink-0 gap-1" onClick={() => addRemit(p.id)}><IndianRupee className="h-3.5 w-3.5" /> Log remittance</Button>
              <Badge variant={TONE[p.status] ?? 'secondary'} className="shrink-0">{p.status}</Badge>
            </div>
          );
        })}
      </RecordList>
    </div>
  );
}
