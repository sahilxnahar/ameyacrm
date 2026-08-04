'use client';
import * as React from 'react';
import { formatCurrency } from '@/lib/utils/format';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, FileText, Lock, Unlock, Plus, Building2, Pencil } from 'lucide-react';
import { blockUnit, releaseUnit, setUnitStatus, generateCostSheet, createUnit, createTower, updateUnit } from '@/server/actions/inventory';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface UnitCell { id: string; code: string; tower: string | null; floor: number | null; typology: string | null; facing: string | null; carpetAreaSqft: number | null; price: number | null; status: string; holdUntil: string | null; tokenAmount: number | null; holdNote: string | null }
interface Opt { id: string; name: string }

// Each needs a dark variant: without one these are dark text on a dark tile in
// dark mode, and the unit code, typology and price in every cell of the matrix
// become unreadable.
const STYLE: Record<string, string> = {
  AVAILABLE: 'bg-emerald-500/15 border-emerald-500/50 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/25',
  HELD: 'bg-amber-500/15 border-amber-500/50 text-amber-800 dark:text-amber-200 hover:bg-amber-500/25',
  BOOKED: 'bg-blue-500/15 border-blue-500/50 text-blue-800 dark:text-blue-200 hover:bg-blue-500/25',
  SOLD: 'bg-rose-500/15 border-rose-500/50 text-rose-800 dark:text-rose-200 hover:bg-rose-500/25',
  BLOCKED: 'bg-slate-400/20 border-slate-400/50 text-slate-700 dark:text-slate-200 hover:bg-slate-400/30',
};
const STATUSES = ['AVAILABLE', 'HELD', 'BOOKED', 'SOLD', 'BLOCKED'];

export function InventoryMatrix({ projects, projectId, units, leads, canManage }: {
  projects: Opt[]; projectId: string | null; units: UnitCell[]; leads: Opt[]; canManage: boolean;
}) {
  const router = useRouter();
  const [sel, setSel] = React.useState<UnitCell | null>(null);
  const [mode, setMode] = React.useState<'view' | 'block' | 'cost' | 'edit'>('view');
  const [adding, setAdding] = React.useState<'unit' | 'tower' | null>(null);
  const [pending, start] = React.useTransition();

  const counts = STATUSES.map((s) => ({ s, n: units.filter((u) => u.status === s).length }));
  const towers = React.useMemo(() => {
    const m = new Map<string, UnitCell[]>();
    for (const u of units) { const t = u.tower || 'Units'; (m.get(t) ?? m.set(t, []).get(t)!).push(u); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [units]);

  const open = (u: UnitCell, m: 'view' | 'block' | 'cost' | 'edit' = 'view') => { setSel(u); setMode(m); };
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

  const fields = (fd: FormData) => ({
    code: fd.get('code'), tower: fd.get('tower') || '', floor: fd.get('floor') || undefined,
    typology: fd.get('typology') || '', facing: fd.get('facing') || '',
    carpetAreaSqft: fd.get('carpetAreaSqft') || undefined, price: fd.get('price') || undefined,
  });

  const submitNewUnit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (!projectId) { toast.error('Pick a project first.'); return; }
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await createUnit({ projectId, ...fields(fd) });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Unit added'); setAdding(null); router.refresh();
    });
  };

  const submitEditUnit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (!sel || !projectId) return;
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await updateUnit({ unitId: sel.id, projectId, ...fields(fd) });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Unit updated'); close(); router.refresh();
    });
  };

  const submitTower = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); if (!projectId) { toast.error('Pick a project first.'); return; }
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await createTower({
        projectId, tower: fd.get('tower'), fromFloor: fd.get('fromFloor'), toFloor: fd.get('toFloor'),
        unitsPerFloor: fd.get('unitsPerFloor'), numbering: fd.get('numbering'), startAt: fd.get('startAt') || 1,
        typology: fd.get('typology') || '', carpetAreaSqft: fd.get('carpetAreaSqft') || undefined, price: fd.get('price') || undefined,
      });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(r.message); setAdding(null); router.refresh();
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
    <div className="page-wide">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={projectId ?? ''} onChange={(e) => router.push(`/inventory?project=${e.target.value}`)} className="h-9 rounded-md border border-input bg-background px-3 text-sm">
          {projects.length === 0 && <option value="">No projects</option>}
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {canManage && projectId && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setAdding('unit')}><Plus className="h-4 w-4" /> Add unit</Button>
            <Button size="sm" variant="outline" onClick={() => setAdding('tower')}><Building2 className="h-4 w-4" /> Add tower</Button>
          </div>
        )}
        <div className="flex flex-wrap gap-2 text-xs">
          {counts.map(({ s, n }) => (
            <span key={s} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${STYLE[s]}`}><b>{n}</b> {s.charAt(0) + s.slice(1).toLowerCase()}</span>
          ))}
        </div>
      </div>

      {units.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">No units for this project yet.</p>
          {canManage && projectId && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={() => setAdding('tower')}><Building2 className="h-4 w-4" /> Generate a tower</Button>
              <Button size="sm" variant="outline" onClick={() => setAdding('unit')}><Plus className="h-4 w-4" /> Add a single unit</Button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-6">
        {towers.map(([tower, list]) => (
          <div key={tower}>
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{tower} <span className="font-normal">· {list.length} units</span></h3>
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(104px,1fr))]">
              {list.map((u) => (
                <button key={u.id} onClick={() => open(u)} className={`rounded-md border p-2 text-left text-xs transition-colors ${STYLE[u.status] ?? ''}`}>
                  <p className="font-semibold">{u.code}</p>
                  <p className="opacity-80">{u.typology ?? '—'}{u.floor != null ? ` · Fl ${u.floor}` : ''}</p>
                  <p className="truncate tabular-nums opacity-70">{formatCurrency(u.price)}</p>
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
                    <Spec k="Facing" v={sel.facing} /><Spec k="Carpet area" v={sel.carpetAreaSqft ? `${formatCurrency(sel.carpetAreaSqft)} sq.ft` : null} />
                    <Spec k="Price" v={formatCurrency(sel.price)} />
                    {sel.holdUntil && <Spec k="Held until" v={new Date(sel.holdUntil).toLocaleString('en-IN')} />}
                    {sel.tokenAmount ? <Spec k="Token" v={formatCurrency(sel.tokenAmount)} /> : null}
                  </div>
                  {sel.holdNote && <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200">{sel.holdNote}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setMode('cost')}><FileText className="h-4 w-4" /> Cost sheet</Button>
                    {canManage && <Button size="sm" variant="outline" onClick={() => setMode('edit')}><Pencil className="h-4 w-4" /> Edit</Button>}
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
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="space-y-1"><Label htmlFor="gstPercent">GST %</Label><Input id="gstPercent" name="gstPercent" type="number" min="0" max="28" step="0.1" defaultValue="5" /></div>
                    <LabeledNum id="stamp" label="Stamp duty" /><LabeledNum id="registration" label="Registration" />
                  </div>
                  <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setMode('view')}>Back</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}<FileText className="h-4 w-4" />Generate PDF</Button></div>
                </form>
              )}
              {mode === 'edit' && (
                <form onSubmit={submitEditUnit} className="space-y-3">
                  <UnitFields unit={sel} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setMode('view')}>Back</Button>
                    <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save changes</Button>
                  </div>
                </form>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add a single unit */}
      <Dialog open={adding === 'unit'} onOpenChange={(o) => !o && setAdding(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add a unit</DialogTitle></DialogHeader>
          <form onSubmit={submitNewUnit} className="space-y-3">
            <UnitFields unit={null} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAdding(null)}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Add unit</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Generate a whole tower */}
      <Dialog open={adding === 'tower'} onOpenChange={(o) => !o && setAdding(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Generate a tower</DialogTitle></DialogHeader>
          <form onSubmit={submitTower} className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Creates every unit on every floor in one go. Codes already in use are left exactly as they are,
              so you can run this again after adding floors.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label htmlFor="t-tower">Tower name</Label><Input id="t-tower" name="tower" required placeholder="A" maxLength={40} /></div>
              <div className="space-y-1"><Label htmlFor="t-upf">Units per floor</Label><Input id="t-upf" name="unitsPerFloor" type="number" min="1" max="26" required defaultValue="4" /></div>
              <div className="space-y-1"><Label htmlFor="t-from">From floor</Label><Input id="t-from" name="fromFloor" type="number" required defaultValue="1" /></div>
              <div className="space-y-1"><Label htmlFor="t-to">To floor</Label><Input id="t-to" name="toFloor" type="number" required defaultValue="12" /></div>
              <div className="space-y-1">
                <Label htmlFor="t-numbering">Unit numbering</Label>
                <select id="t-numbering" name="numbering" defaultValue="NUMERIC" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="NUMERIC">A-1201, A-1202…</option>
                  <option value="ALPHA">A-12A, A-12B…</option>
                </select>
              </div>
              <div className="space-y-1"><Label htmlFor="t-start">First unit number</Label><Input id="t-start" name="startAt" type="number" min="1" max="99" defaultValue="1" /></div>
              <div className="space-y-1"><Label htmlFor="t-typ">Typology</Label><Input id="t-typ" name="typology" placeholder="3BHK" maxLength={40} /></div>
              <div className="space-y-1"><Label htmlFor="t-area">Carpet area (sq.ft)</Label><Input id="t-area" name="carpetAreaSqft" type="number" min="0" step="0.01" placeholder="Optional" /></div>
              <div className="space-y-1 col-span-2"><Label htmlFor="t-price">Price per unit (₹)</Label><Input id="t-price" name="price" type="number" min="0" placeholder="Optional — set per unit later" /></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAdding(null)}>Cancel</Button>
              <Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Generate</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** The shared unit fields, used both to add a new unit and to correct one. */
function UnitFields({ unit }: { unit: UnitCell | null }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1"><Label htmlFor="u-code">Unit code</Label><Input id="u-code" name="code" required maxLength={40} defaultValue={unit?.code ?? ''} placeholder="A-1203" /></div>
      <div className="space-y-1"><Label htmlFor="u-tower">Tower</Label><Input id="u-tower" name="tower" maxLength={40} defaultValue={unit?.tower ?? ''} placeholder="A" /></div>
      <div className="space-y-1"><Label htmlFor="u-floor">Floor</Label><Input id="u-floor" name="floor" type="number" defaultValue={unit?.floor ?? ''} placeholder="12" /></div>
      <div className="space-y-1"><Label htmlFor="u-typ">Typology</Label><Input id="u-typ" name="typology" maxLength={40} defaultValue={unit?.typology ?? ''} placeholder="3BHK" /></div>
      <div className="space-y-1"><Label htmlFor="u-facing">Facing</Label><Input id="u-facing" name="facing" maxLength={20} defaultValue={unit?.facing ?? ''} placeholder="East" /></div>
      <div className="space-y-1"><Label htmlFor="u-area">Carpet area (sq.ft)</Label><Input id="u-area" name="carpetAreaSqft" type="number" min="0" step="0.01" defaultValue={unit?.carpetAreaSqft ?? ''} /></div>
      <div className="space-y-1 col-span-2"><Label htmlFor="u-price">Price (₹)</Label><Input id="u-price" name="price" type="number" min="0" defaultValue={unit?.price ?? ''} /></div>
    </div>
  );
}

function Spec({ k, v }: { k: string; v: string | null }) {
  return <div><p className="text-[11px] uppercase text-muted-foreground">{k}</p><p className="font-medium">{v || '—'}</p></div>;
}
function LabeledNum({ id, label }: { id: string; label: string }) {
  return <div className="space-y-1"><Label htmlFor={id} className="text-xs">{label} (₹)</Label><Input id={id} name={id} type="number" min="0" placeholder="0" /></div>;
}
