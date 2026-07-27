'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { Landmark, Wallet, AlertTriangle, Search, Calculator, Check } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Monogram, statusAccent, RecordList } from '@/components/shared/record-row';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { TDS_SECTIONS } from '@/config/tds-sections';
import { computeTds } from '@/lib/tax/tds';
import { tdsLookup, depositTds, type TdsEntry } from '@/server/actions/tds';

interface Dashboard {
  accrued: number; deposited: number; pending: number; count: number; pendingCount: number;
  bySection: Array<{ section: string; tds: number; count: number }>;
  recent: TdsEntry[];
}

function inr(n: number) { return formatCurrency(n); }

/** One TDS ledger row — colour-coded by deposit status. */
function TdsRow({ e, selected, onToggle, selectable }: { e: TdsEntry; selected: boolean; onToggle: () => void; selectable: boolean }) {
  const status = e.deposited ? 'paid' : 'pending';
  return (
    <div className={cn('flex items-center gap-3 border-b border-l-2 px-3 py-2.5 last:border-b-0', statusAccent(status))}>
      {selectable && !e.deposited && (
        <input type="checkbox" checked={selected} onChange={onToggle} className="h-4 w-4 shrink-0" onClick={(ev) => ev.stopPropagation()} />
      )}
      <Monogram name={e.party} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{e.party}</div>
        <div className="truncate text-xs text-muted-foreground">
          <span className="font-mono">{e.number}</span>
          {e.section ? ` · ${e.section}` : ' · unmapped'}
          {e.rate != null ? ` @ ${e.rate}%` : ''}
          {e.bankName ? ` · ${e.bankName}` : ''}
        </div>
      </div>
      <div className="hidden text-right text-xs text-muted-foreground sm:block">
        <div>on {inr(e.base)}</div>
        <div>{new Date(e.date).toLocaleDateString('en-IN')}</div>
      </div>
      <div className="w-24 shrink-0 text-right font-medium tabular-nums">{inr(e.tds)}</div>
      <Badge variant={e.deposited ? 'success' : 'warning'} className="shrink-0">
        {e.deposited ? 'Deposited' : 'Pending'}
      </Badge>
    </div>
  );
}

export function TdsView({ dashboard, canManage }: { dashboard: Dashboard; canManage: boolean }) {
  // ── Lookup ──
  const [q, setQ] = React.useState('');
  const [results, setResults] = React.useState<{ entries: TdsEntry[]; totals: { accrued: number; deposited: number; pending: number } } | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [challan, setChallan] = React.useState('');
  const [, start] = React.useTransition();

  const shown = results ? results.entries : dashboard.recent;
  const totals = results ? results.totals : { accrued: dashboard.accrued, deposited: dashboard.deposited, pending: dashboard.pending };

  async function lookup(e?: React.FormEvent) {
    e?.preventDefault();
    if (!q.trim()) { setResults(null); return; }
    setSearching(true); setSel(new Set());
    const r = await tdsLookup(q.trim());
    setSearching(false);
    if ('error' in r) { toast.error(r.error); return; }
    setResults({ entries: r.entries, totals: r.totals });
  }

  function toggle(id: string) { setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }

  function markDeposited() {
    if (sel.size === 0) { toast.error('Select at least one pending entry.'); return; }
    if (!challan.trim()) { toast.error('Enter the challan / BSR number.'); return; }
    start(async () => {
      const r = await depositTds({ voucherIds: [...sel], challanNo: challan.trim() });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`Marked ${r.updated} deducted payment(s) as deposited`);
      setSel(new Set()); setChallan('');
      if (results) lookup(); else location.reload();
    });
  }

  // ── Calculator ──
  const [calcSection, setCalcSection] = React.useState('194C');
  const [calcAmount, setCalcAmount] = React.useState('');
  const [calcPan, setCalcPan] = React.useState(true);
  const calc = computeTds({ sectionCode: calcSection, base: Number(calcAmount) || 0, hasPan: calcPan });

  return (
    <div className="space-y-6">
      {/* Position */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3">
        <StatCard label="TDS liability accrued" value={inr(dashboard.accrued)} icon={Landmark} hint={`${dashboard.count} deductions`} />
        <StatCard label="Deposited to govt" value={inr(dashboard.deposited)} icon={Wallet} tone="success" />
        <StatCard label="Pending to deposit" value={inr(dashboard.pending)} icon={AlertTriangle} tone={dashboard.pending > 0 ? 'warning' : 'success'} hint={`${dashboard.pendingCount} pending`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Ledger + lookup */}
        <div className="space-y-3">
          <form onSubmit={lookup} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Look up a bank account — vendor, bank name, IFSC or account no." className="pl-8" />
            </div>
            <Button type="submit" disabled={searching}>{searching ? 'Searching…' : 'Search'}</Button>
            {results && <Button type="button" variant="ghost" onClick={() => { setResults(null); setQ(''); }}>Clear</Button>}
          </form>

          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{results ? `Ledger for “${q}”` : 'Recent deductions'}</span>
            <span className="text-xs text-muted-foreground">Accrued {inr(totals.accrued)} · Deposited {inr(totals.deposited)} · Pending {inr(totals.pending)}</span>
          </div>

          <RecordList empty={results ? 'No TDS entries for that account.' : 'No TDS deducted yet.'}>
            {shown.map((e) => (
              <TdsRow key={e.id} e={e} selected={sel.has(e.id)} onToggle={() => toggle(e.id)} selectable={canManage} />
            ))}
          </RecordList>

          {canManage && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
              <span className="text-sm">{sel.size} selected</span>
              <Input value={challan} onChange={(e) => setChallan(e.target.value)} placeholder="Challan / BSR no." className="h-8 max-w-[200px]" />
              <Button size="sm" onClick={markDeposited} disabled={sel.size === 0} className="gap-1"><Check className="h-4 w-4" /> Mark deposited</Button>
            </div>
          )}
        </div>

        {/* Right rail: calculator + section split */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-2 flex items-center gap-2 font-semibold"><Calculator className="h-4 w-4 text-primary" /> Quick TDS calculator</div>
            <div className="space-y-2">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Section</span>
                <select value={calcSection} onChange={(e) => setCalcSection(e.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm">
                  {TDS_SECTIONS.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.label}</option>)}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">Payment amount (₹)</span>
                <Input value={calcAmount} onChange={(e) => setCalcAmount(e.target.value)} inputMode="numeric" placeholder="0" />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={calcPan} onChange={(e) => setCalcPan(e.target.checked)} className="h-4 w-4" />
                Deductee has a valid PAN
              </label>
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Rate</span><span className="font-medium">{calc.rate}%</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TDS to deduct</span><span className="font-semibold text-primary">{inr(calc.amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Net payable</span><span className="font-medium">{inr(calc.net)}</span></div>
                <p className="mt-1 text-xs text-muted-foreground">{calc.reason}</p>
              </div>
            </div>
          </Card>

          {dashboard.bySection.length > 0 && (
            <Card className="p-4">
              <div className="mb-2 text-sm font-semibold">By section</div>
              <div className="space-y-1.5">
                {dashboard.bySection.map((s) => (
                  <div key={s.section} className="flex items-center justify-between text-sm">
                    <span><Badge variant="secondary" className="mr-1.5">{s.section}</Badge><span className="text-xs text-muted-foreground">{s.count}</span></span>
                    <span className="tabular-nums">{inr(s.tds)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
