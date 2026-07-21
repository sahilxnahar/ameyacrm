'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, X } from 'lucide-react';
import { saveFeasibility } from '@/server/actions/feasibility';
import { StatTile, StatTileRow } from '@/components/ui/stat-tile';
import { Field, FormGrid } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChipRow, ChipLink } from '@/components/ui/chip';
import { cn } from '@/lib/utils/cn';

const inr = (n: number | null) => (n == null ? '—' : n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }));

interface Row {
  id: string; name: string; landCost: number; constructionCost: number; financeCost: number; otherCost: number;
  saleableAreaSqft: number; salePricePerSqft: number; targetReturnPct: number | null; salePriceDeltaPct: number; costDeltaPct: number;
  result: { totalCost: number; saleValue: number; profit: number; profitOnCostPct: number; marginPct: number };
  residualLand: number | null;
}
type Res = { ok: true; message: string; id?: string } | { error: string };

export function FeasibilityView({ canManage, projects, projectId, rows }: {
  canManage: boolean; projects: Array<{ id: string; name: string }>; projectId: string | null; rows: Row[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ bad: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const run = (fn: () => Promise<Res>) => start(async () => { const r = await fn(); setMsg('error' in r ? { bad: true, text: r.error } : { bad: false, text: r.message }); if (!('error' in r)) { setOpen(false); router.refresh(); } });

  const best = rows.reduce((m, r) => Math.max(m, r.result.profitOnCostPct), 0);

  return (
    <div className="space-y-4">
      {projects.length > 1 && <ChipRow><ChipLink href="/feasibility" active={projectId == null}>All</ChipLink>{projects.map((p) => <ChipLink key={p.id} href={`/feasibility?project=${p.id}`} active={p.id === projectId}>{p.name}</ChipLink>)}</ChipRow>}
      <StatTileRow cols={3}>
        <StatTile label="Appraisals" value={String(rows.length)} sub="on record" />
        <StatTile label="Best profit-on-cost" value={`${best}%`} sub="across models" tone={best > 0 ? 'good' : 'default'} />
        <StatTile label="Total sale value" value={inr(rows.reduce((s, r) => s + r.result.saleValue, 0))} sub="modelled" />
      </StatTileRow>

      {canManage && (
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>{open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{open ? 'Close' : 'New appraisal'}</Button>
      )}
      {open && canManage && (
        <form className="rounded-lg border border-border p-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); const g = (k: string) => Number(f.get(k) || 0); run(() => saveFeasibility({ projectId, name: f.get('name') as string, landCost: g('landCost'), constructionCost: g('constructionCost'), financeCost: g('financeCost'), otherCost: g('otherCost'), saleableAreaSqft: g('saleableAreaSqft'), salePricePerSqft: g('salePricePerSqft'), targetReturnPct: f.get('targetReturnPct') ? g('targetReturnPct') : null, salePriceDeltaPct: g('salePriceDeltaPct'), costDeltaPct: g('costDeltaPct') })); }}>
          <FormGrid cols={3}>
            <Field label="Name" required><Input name="name" required /></Field>
            <Field label="Land cost (₹)"><Input name="landCost" type="number" /></Field>
            <Field label="Construction cost (₹)"><Input name="constructionCost" type="number" /></Field>
            <Field label="Finance cost (₹)"><Input name="financeCost" type="number" /></Field>
            <Field label="Other cost (₹)"><Input name="otherCost" type="number" /></Field>
            <Field label="Saleable area (sqft)"><Input name="saleableAreaSqft" type="number" /></Field>
            <Field label="Sale price / sqft (₹)"><Input name="salePricePerSqft" type="number" /></Field>
            <Field label="Target return %" hint="for residual land value"><Input name="targetReturnPct" type="number" step="0.1" /></Field>
            <Field label="Sale price Δ%" hint="scenario"><Input name="salePriceDeltaPct" type="number" step="0.1" defaultValue={0} /></Field>
            <Field label="Cost Δ%" hint="scenario"><Input name="costDeltaPct" type="number" step="0.1" defaultValue={0} /></Field>
          </FormGrid>
          <div className="mt-3"><Button type="submit" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save appraisal</Button></div>
        </form>
      )}
      {msg && <p className={cn('text-sm', msg.bad ? 'text-destructive' : 'text-emerald-600')}>{msg.text}</p>}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No appraisals yet. Model land, construction, finance and sales to see profit on cost and residual land value.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground"><tr className="text-left"><th className="p-2">Appraisal</th><th className="p-2">Total cost</th><th className="p-2">Sale value</th><th className="p-2">Profit</th><th className="p-2">On cost</th><th className="p-2">Margin</th><th className="p-2">Residual land</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-2">{r.name}{(r.salePriceDeltaPct !== 0 || r.costDeltaPct !== 0) && <span className="ml-1 text-xs text-amber-600">scenario</span>}</td>
                  <td className="p-2">{inr(r.result.totalCost)}</td>
                  <td className="p-2">{inr(r.result.saleValue)}</td>
                  <td className={cn('p-2 font-medium', r.result.profit < 0 ? 'text-destructive' : 'text-emerald-600')}>{inr(r.result.profit)}</td>
                  <td className="p-2">{r.result.profitOnCostPct}%</td>
                  <td className="p-2">{r.result.marginPct}%</td>
                  <td className="p-2">{r.residualLand != null ? inr(r.residualLand) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
