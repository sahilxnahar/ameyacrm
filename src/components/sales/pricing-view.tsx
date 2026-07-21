'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, X, Building2, HandCoins } from 'lucide-react';
import { saveUnitPricing, recordCommission, advanceCommission } from '@/server/actions/pricing';
import { StatTile, StatTileRow } from '@/components/ui/stat-tile';
import { Field, FormGrid } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { Button } from '@/components/ui/button';
import { ChipRow, ChipLink } from '@/components/ui/chip';
import { cn } from '@/lib/utils/cn';

const inr = (n: number | null) => (n == null ? '—' : n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }));

interface PriceResult {
  grossPrice: number; discountAmount: number; netPrice: number; discountPct: number; effectiveRatePerSqft: number;
}
interface UnitRow {
  unitId: string; code: string; tower: string | null; floor: number | null; typology: string | null; areaSqft: number | null;
  facing: string | null; hasPricing: boolean; baseRatePerSqft: number; floorRisePerSqft: number; baseFloor: number;
  plcPerSqft: number; viewPremiumPerSqft: number; lumpSum: number; discountAmount: number; price: PriceResult | null;
}
interface CommissionRow {
  id: string; channelPartnerId: string; partnerName: string; bookingValue: number; ratePct: number;
  grossCommission: number; tdsAmount: number; netPayable: number; status: string; paidOn: Date | null; createdAt: Date;
}
interface Commissions {
  rows: CommissionRow[]; totalGross: number; totalNet: number; pendingCount: number;
  partners: Array<{ id: string; name: string; commissionPct: number }>;
}
type Tab = 'pricing' | 'commissions';
type Res = { ok: true; message: string; id?: string } | { error: string };

export function PricingView({ canManage, projects, projectId, units, commissions }: {
  canManage: boolean; projects: Array<{ id: string; name: string }>; projectId: string | null; units: UnitRow[]; commissions: Commissions;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('pricing');
  const [msg, setMsg] = useState<{ bad: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [editUnit, setEditUnit] = useState<string | null>(null);
  const [showCommission, setShowCommission] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);

  const run = (fn: () => Promise<Res>) => start(async () => {
    const r = await fn();
    setMsg('error' in r ? { bad: true, text: r.error } : { bad: false, text: r.message });
    if (!('error' in r)) { setEditUnit(null); setShowCommission(false); router.refresh(); }
  });

  const priced = units.filter((u) => u.price != null).length;

  return (
    <div className="space-y-4">
      {projects.length > 1 && (
        <ChipRow>
          {projects.map((p) => <ChipLink key={p.id} href={`/pricing?project=${p.id}`} active={p.id === projectId}>{p.name}</ChipLink>)}
        </ChipRow>
      )}

      <StatTileRow cols={4}>
        <StatTile icon={<Building2 className="h-4 w-4" />} label="Units priced" value={`${priced}/${units.length}`} sub="with a computed price" />
        <StatTile icon={<HandCoins className="h-4 w-4" />} label="Commission (gross)" value={inr(commissions.totalGross)} sub={`${commissions.rows.length} payouts`} />
        <StatTile label="Net payable" value={inr(commissions.totalNet)} sub="after TDS" />
        <StatTile label="Pending" value={String(commissions.pendingCount)} sub="awaiting approval" tone={commissions.pendingCount > 0 ? 'bad' : 'default'} />
      </StatTileRow>

      <div className="flex gap-1 border-b border-border">
        {(['pricing', 'commissions'] as Tab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cn('focus-ring -mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize', tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>{t === 'commissions' ? 'Broker commissions' : 'Unit pricing'}</button>
        ))}
      </div>

      {msg && <p className={cn('text-sm', msg.bad ? 'text-destructive' : 'text-emerald-600')}>{msg.text}</p>}

      {tab === 'pricing' && (
        units.length === 0 ? (
          <Empty text="No units in this project yet. Add inventory, then set pricing here." />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr className="text-left"><th className="p-2">Unit</th><th className="p-2">Area</th><th className="p-2">Base rate</th><th className="p-2">Gross</th><th className="p-2">Disc.</th><th className="p-2">Net price</th><th className="p-2">₹/sqft</th>{canManage && <th className="p-2" />}</tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <PricingRow key={u.unitId} u={u} canManage={canManage} projectId={projectId} pending={pending} open={editUnit === u.unitId} onToggle={() => setEditUnit(editUnit === u.unitId ? null : u.unitId)} run={run} />
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'commissions' && (
        <div className="space-y-3">
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setShowCommission((v) => !v)}>
              {showCommission ? <X className="h-4 w-4" /> : <HandCoins className="h-4 w-4" />}{showCommission ? 'Close' : 'Record commission'}
            </Button>
          )}
          {showCommission && canManage && (
            <form className="rounded-lg border border-border p-4"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (!partnerId) { setMsg({ bad: true, text: 'Pick a channel partner.' }); return; }
                run(() => recordCommission({ channelPartnerId: partnerId, projectId, bookingValue: Number(f.get('bookingValue') || 0), note: (f.get('note') as string) || null }));
              }}>
              <FormGrid cols={3}>
                <Field label="Channel partner" required>
                  <Combobox
                    options={commissions.partners.map((p) => ({ value: p.id, label: p.name, hint: `${p.commissionPct}%` }))}
                    value={partnerId} onChange={setPartnerId} placeholder="Search partners…"
                  />
                </Field>
                <Field label="Booking value (₹)" required><Input name="bookingValue" type="number" step="1" required /></Field>
                <Field label="Note"><Input name="note" /></Field>
              </FormGrid>
              <div className="mt-3"><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Compute & record</Button></div>
              <p className="mt-2 text-xs text-muted-foreground">Rate comes from the partner's own % if set, else the slab table; TDS is deducted at source.</p>
            </form>
          )}

          {commissions.rows.length === 0 ? (
            <Empty text="No commissions recorded yet." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground"><tr className="text-left"><th className="p-2">Partner</th><th className="p-2">Booking value</th><th className="p-2">Rate</th><th className="p-2">Gross</th><th className="p-2">TDS</th><th className="p-2">Net</th><th className="p-2">Status</th>{canManage && <th className="p-2" />}</tr></thead>
                <tbody>
                  {commissions.rows.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="p-2">{c.partnerName}</td>
                      <td className="p-2">{inr(c.bookingValue)}</td>
                      <td className="p-2">{c.ratePct}%</td>
                      <td className="p-2">{inr(c.grossCommission)}</td>
                      <td className="p-2 text-muted-foreground">{inr(c.tdsAmount)}</td>
                      <td className="p-2 font-medium">{inr(c.netPayable)}</td>
                      <td className="p-2"><span className={cn('rounded-full px-2 py-0.5 text-xs', c.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-600' : c.status === 'CANCELLED' ? 'bg-muted text-muted-foreground' : c.status === 'APPROVED' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-600')}>{c.status.toLowerCase()}</span></td>
                      {canManage && (
                        <td className="p-2">
                          {c.status === 'PENDING' && <button type="button" disabled={pending} onClick={() => run(() => advanceCommission(c.id, 'APPROVED'))} className="text-xs text-primary hover:underline">approve</button>}
                          {c.status === 'APPROVED' && <button type="button" disabled={pending} onClick={() => run(() => advanceCommission(c.id, 'PAID'))} className="text-xs text-primary hover:underline">mark paid</button>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PricingRow({ u, canManage, projectId, pending, open, onToggle, run }: {
  u: UnitRow; canManage: boolean; projectId: string | null; pending: boolean; open: boolean; onToggle: () => void; run: (fn: () => Promise<Res>) => void;
}) {
  return (
    <>
      <tr className="border-t border-border">
        <td className="p-2">{u.code}<span className="block text-xs text-muted-foreground">{[u.tower, u.typology, u.facing].filter(Boolean).join(' · ')}</span></td>
        <td className="p-2">{u.areaSqft != null ? `${u.areaSqft} sqft` : '—'}</td>
        <td className="p-2">{u.baseRatePerSqft > 0 ? inr(u.baseRatePerSqft) : '—'}</td>
        <td className="p-2">{u.price ? inr(u.price.grossPrice) : '—'}</td>
        <td className="p-2">{u.price && u.price.discountAmount > 0 ? `${u.price.discountPct}%` : '—'}</td>
        <td className="p-2 font-medium">{u.price ? inr(u.price.netPrice) : <span className="text-muted-foreground">not priced</span>}</td>
        <td className="p-2">{u.price ? inr(u.price.effectiveRatePerSqft) : '—'}</td>
        {canManage && <td className="p-2"><button type="button" onClick={onToggle} className="text-xs text-primary hover:underline">{open ? 'close' : u.hasPricing ? 'edit' : 'price'}</button></td>}
      </tr>
      {open && canManage && (
        <tr className="border-t border-border bg-muted/20">
          <td colSpan={8} className="p-3">
            <form onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              run(() => saveUnitPricing({
                unitId: u.unitId, projectId,
                baseRatePerSqft: Number(f.get('baseRatePerSqft') || 0),
                baseFloor: Number(f.get('baseFloor') || 0),
                floorRisePerSqft: Number(f.get('floorRisePerSqft') || 0),
                plcPerSqft: Number(f.get('plcPerSqft') || 0),
                viewPremiumPerSqft: Number(f.get('viewPremiumPerSqft') || 0),
                lumpSum: Number(f.get('lumpSum') || 0),
                discountAmount: Number(f.get('discountAmount') || 0),
              }));
            }}>
              <FormGrid cols={3}>
                <Field label="Base rate / sqft" required><Input name="baseRatePerSqft" type="number" step="1" defaultValue={u.baseRatePerSqft || ''} required /></Field>
                <Field label="Floor rise / sqft"><Input name="floorRisePerSqft" type="number" step="1" defaultValue={u.floorRisePerSqft || ''} /></Field>
                <Field label="Base floor" hint="floor rise charged above this"><Input name="baseFloor" type="number" step="1" defaultValue={u.baseFloor || 0} /></Field>
                <Field label="PLC / sqft"><Input name="plcPerSqft" type="number" step="1" defaultValue={u.plcPerSqft || ''} /></Field>
                <Field label="View premium / sqft"><Input name="viewPremiumPerSqft" type="number" step="1" defaultValue={u.viewPremiumPerSqft || ''} /></Field>
                <Field label="Lump sums (₹)"><Input name="lumpSum" type="number" step="1" defaultValue={u.lumpSum || ''} /></Field>
                <Field label="Discount (₹)"><Input name="discountAmount" type="number" step="1" defaultValue={u.discountAmount || ''} /></Field>
              </FormGrid>
              <div className="mt-3"><Button type="submit" disabled={pending} size="sm">{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save pricing</Button></div>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>;
}
