'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, FileText, Lock, Unlock } from 'lucide-react';
import { blockUnit, releaseUnit, setUnitStatus, generateCostSheet } from '@/server/actions/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface UnitCell { id: string; code: string; tower: string | null; floor: number | null; typology: string | null; facing: string | null; carpetAreaSqft: number | null; price: number | null; status: string; holdUntil: string | null; tokenAmount: number | null; holdNote: string | null }
interface Opt { id: string; name: string }

const STYLE: Record<string, string> = {
  AVAILABLE: 'bg-emerald-500/15 border-emerald-500/50 text-emerald-800 hover:bg-emerald-500/25',
  HELD: 'bg-amber-500/15 border-amber-500/50 text-amber-800 hover:bg-amber-500/25',
  BOOKED: 'bg-blue-500/15 border-blue-500/50 text-blue-800 hover:bg-blue-500/25',
  SOLD: 'bg-rose-500/15 border-rose-500/50 text-rose-800 hover:bg-rose-500/25',
  BLOCKED: 'bg-slate-400/20 border-slate-400/50 text-slate-700 hover:bg-slate-400/30',
};
const STATUSES = ['AVAILABLE', 'HELD', 'BOOKED', 'SOLD', 'BLOCKED'];
const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const money = (n: number | null) => (n == null ? '—' : `₹${inr.format(n)}`);

export function InventoryMatrix({ projects, projectId, units, leads, canManage }: {
  projects: Opt[]; projectId: string | null; units: UnitCell[]; leads: Opt[]; canManage: boolean;
}) {
  const router = useRouter();
  const [sel, setSel] = React.useState<UnitCell | null>(null);
  const [mode, setMode] = React.useState<'view' | 'block' | 'cost'>('view');
  const [pending, start] = React.useTransition();

  const counts = STATUSES.map((s) => ({ s, n: units.filter((u) => u.status === s).length }));
  const towers = React.useMemo(() => {
    const m = new Map<string, UnitCell[]>();
    for (const u of units) { const t = u.tower || 'Units'; (m.get(t) ?? m.set(t, []).get(t)!).push(u); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [units]);

  const open = (u: UnitCell, m: 'view' | 'block' | 'cost' = 'view') => { setSel(u); setMode(m); };
  const close = () => setSel(null);

  const doRelease = (id: string) => start(async () => { const r = await releaseUnit(id); if ('error' in r) { toast.error(r.error); return; } toast.success('Unit released'); close(); router.refresh(); });
  const doStatus = (id: string, status: string) => start(async () => { const r = await setUnitStatus({ unitId: id, status }); if ('error' in r) { toast.error(r.error); return; } toast.success(`Marked ${status.toLowerCase()}`); close(); router.refresh(); });

  const submitBlock = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (!sel) return; const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await blockUnit({ unitId: sel.id, hours: fd.get('hours'), tokenAmount: fd.get('tokenAmount') || undefined, leadId: fd.get('leadId') || null, note: fd.get('note') || undefined });
      if ('error' in r) { toast.error(r.error); return; } toast.success('Unit blocked'); close(); router.refresh();
    });
  };

  const submitCost = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (!sel) return; const fd = new FormData(e.currentTarget);
    const num = (k: string) => { const v = parseFloat(String(fd.get(k) || '')); return isNaN(v) ? 0 : v; };
    const extras = [
      ['Preferential Location (PLC)', num('plc')], ['Floor Rise', num('floorRise')],
      ['Car Parking', num('parking')], ['Club & Amenities', num('club')],
    ].filter(([, a]) => (a as number) > 0).map(([label, amount]) => ({ label: label as string, amount: amount as number }));
    const otherCharges = [
      ['Stamp Duty', num('stamp')], ['Registration', num('registration')], ['Legal & Documentation', num('legal')],
    ].filter(([, a]) => (a as number) > 0).map(([label, amount]) => ({ label: label as string, amount: amount as number }));
    start(async () => {
      const r = await generateCostSheet({ unitId: sel.id, clientName: fd.get('clientName') || undefined, basePrice: num('basePrice'), gstPercent: fd.get('gstPercent'), extras, otherCharges });
      if ('error' in r) { toast.error(r.error); return; }
      const a = document.createElement('a'); a.href = `data:application/pdf;base64,${r.pdfBase64}`; a.download = r.filename; a.click();
      toast.success('Cost sheet downloaded'); close();
    });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={projectId ?? ''} onChange={(e) => router.push(`/inventory?project=${e.target.value}`)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          {projects.length === 0 && <option value="">No projects</option>}
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex flex-wrap gap-2 text-xs">
          {counts.map(({ s, n }) => (
            <span key={s} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${STYLE[s]}`}><b>{n}</b> {s.charAt(0) + s.slice(1).toLowerCase()}</span>
          ))}
        </div>
      </div>

      {units.length === 0 && <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No units for this project yet. Add units under the project to populate the matrix.</p>}

      <div className="space-y-6">
        {towers.map(([tower, list]) => (
          <div key={tower}>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{tower} <span className="font-normal">· {list.length} units</span></h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {list.map((u) => (
                <button key={u.id} onClick={() => open(u)} className={`rounded-md border p-2 text-left text-xs transition-colors ${STYLE[u.status] ?? ''}`}>
                  <p className="font-semibold">{u.code}</p>
                  <p className="opacity-80">{u.typology ?? '—'}{u.floor != null ? ` · Fl ${u.floor}` : ''}</p>
                  <p className="opacity-70">{money(u.price)}</p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Unit dialog */}
      <Dialog open={!!sel} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-md">
          {sel && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">{sel.code}<Badge className={STYLE[sel.status]}>{sel.status}</Badge></DialogTitle>
              </DialogHeader>

              {mode === 'view' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <Spec k="Typology" v={sel.typology} /><Spec k="Tower / Floor" v={`${sel.tower ?? '—'} / ${sel.floor ?? '—'}`} />
                    <Spec k="Facing" v={sel.facing} /><Spec k="Carpet area" v={sel.carpetAreaSqft ? `${inr.format(sel.carpetAreaSqft)} sq.ft` : null} />
                    <Spec k="Price" v={money(sel.price)} />
                    {sel.holdUntil && <Spec k="Held until" v={new Date(sel.holdUntil).toLocaleString('en-IN')} />}
                    {sel.tokenAmount ? <Spec k="Token" v={money(sel.tokenAmount)} /> : null}
                  </div>
                  {sel.holdNote && <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-800">{sel.holdNote}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setMode('cost')}><FileText className="h-4 w-4" /> Cost sheet</Button>
                    {canManage && sel.status !== 'HELD' && sel.status !== 'SOLD' && sel.status !== 'BOOKED' && <Button size="sm" onClick={() => setMode('block')}><Lock className="h-4 w-4" /> Block</Button>}
                    {canManage && (sel.status === 'HELD' || sel.status === 'BLOCKED') && <Button size="sm" variant="outline" onClick={() => doRelease(sel.id)} disabled={pending}><Unlock className="h-4 w-4" /> Release</Button>}
                  </div>
                  {canManage && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Set status</Label>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {STATUSES.map((s) => <Button key={s} size="sm" variant={sel.status === s ? 'default' : 'outline'} className="h-7 text-xs" disabled={pending || sel.status === s} onClick={() => doStatus(sel.id, s)}>{s.charAt(0) + s.slice(1).toLowerCase()}</Button>)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {mode === 'block' && (
                <form onSubmit={submitBlock} className="space-y-3">
                  <p className="text-sm text-muted-foreground">Hold {sel.code} with a token. It auto-releases when the hold expires.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label htmlFor="hours">Hold for</Label>
                      <select id="hours" name="hours" defaultValue="48" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="24">24 hours</option><option value="48">48 hours</option><option value="72">72 hours</option></select></div>
                    <div className="space-y-1"><Label htmlFor="tokenAmount">Token (₹)</Label><Input id="tokenAmount" name="tokenAmount" type="number" min="0" placeholder="e.g. 100000" /></div>
                  </div>
                  <div className="space-y-1"><Label htmlFor="leadId">For lead (optional)</Label>
                    <select id="leadId" name="leadId" defaultValue="" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">—</option>{leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
                  <div className="space-y-1"><Label htmlFor="note">Note</Label><Input id="note" name="note" placeholder="Reason / reference" /></div>
                  <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setMode('view')}>Back</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Block unit</Button></div>
                </form>
              )}

              {mode === 'cost' && (
                <form onSubmit={submitCost} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label htmlFor="clientName">Client name</Label><Input id="clientName" name="clientName" placeholder="Optional" /></div>
                    <div className="space-y-1"><Label htmlFor="basePrice">Basic price (₹)</Label><Input id="basePrice" name="basePrice" type="number" min="0" required defaultValue={sel.price ?? ''} /></div>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">Additional charges (leave blank to skip)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <LabeledNum id="plc" label="PLC" /><LabeledNum id="floorRise" label="Floor rise" />
                    <LabeledNum id="parking" label="Car parking" /><LabeledNum id="club" label="Club & amenities" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1"><Label htmlFor="gstPercent">GST %</Label><Input id="gstPercent" name="gstPercent" type="number" min="0" max="28" step="0.1" defaultValue="5" /></div>
                    <LabeledNum id="stamp" label="Stamp duty" /><LabeledNum id="registration" label="Registration" />
                  </div>
                  <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setMode('view')}>Back</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}<FileText className="h-4 w-4" />Generate PDF</Button></div>
                </form>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Spec({ k, v }: { k: string; v: string | null }) {
  return <div><p className="text-[10px] uppercase text-muted-foreground">{k}</p><p className="font-medium">{v || '—'}</p></div>;
}
function LabeledNum({ id, label }: { id: string; label: string }) {
  return <div className="space-y-1"><Label htmlFor={id} className="text-xs">{label} (₹)</Label><Input id={id} name={id} type="number" min="0" placeholder="0" /></div>;
}
