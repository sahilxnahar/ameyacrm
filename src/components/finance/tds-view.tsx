'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Landmark, Wallet, AlertTriangle, Search, Calculator, Check, Plus, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { tdsLookup, depositTds, recordTdsDeduction, setVoucherTdsSection, type TdsEntry } from '@/server/actions/tds';

interface Dashboard {
  accrued: number; deposited: number; pending: number; count: number; pendingCount: number;
  bySection: Array<{ section: string; tds: number; count: number }>;
  recent: TdsEntry[];
}

function inr(n: number) { return formatCurrency(n); }

/**
 * Classify a deduction that came in without a section.
 *
 * The vendor-payment form captures a rate and an amount but never a section, so
 * everything entered that way piles up under "Unmapped" — and "Unmapped" is
 * precisely the pile you cannot file a 26Q from. One dropdown per row fixes it
 * where you are already looking.
 */
function SectionPicker({ e, onDone }: { e: TdsEntry; onDone: () => void }) {
  const [pending, start] = React.useTransition();
  return (
    <select
      defaultValue={e.section ?? ''}
      disabled={pending}
      onClick={(ev) => ev.stopPropagation()}
      onChange={(ev) => {
        const value = ev.target.value || null;
        start(async () => {
          const r = await setVoucherTdsSection(e.id, value);
          if ('error' in r) { toast.error(r.error); return; }
          toast.success(value ? `${e.number} classified under ${value}` : `${e.number} unclassified`);
          onDone();
        });
      }}
      className={cn('h-7 shrink-0 rounded-md border bg-background px-1 text-xs', !e.section && 'border-amber-500/60 text-amber-700 dark:text-amber-500')}
      title="TDS section"
    >
      <option value="">Unmapped</option>
      {TDS_SECTIONS.map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}
    </select>
  );
}

/** One TDS ledger row — colour-coded by deposit status. */
function TdsRow({ e, selected, onToggle, selectable, onChanged }: { e: TdsEntry; selected: boolean; onToggle: () => void; selectable: boolean; onChanged?: () => void }) {
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
      {selectable && onChanged && <SectionPicker e={e} onDone={onChanged} />}
      <Badge variant={e.deposited ? 'success' : 'warning'} className="shrink-0">
        {e.deposited ? 'Deposited' : 'Pending'}
      </Badge>
    </div>
  );
}

export function TdsView({ dashboard, canManage }: { dashboard: Dashboard; canManage: boolean }) {
  // AMH-029 — router.refresh() re-runs the server components and swaps the
  // new HTML in. router.refresh() threw the whole document away: scroll
  // position, open filters, a half-typed field in another panel, and a
  // second of white screen. The server action already calls revalidatePath,
  // so the data is fresh either way.
  const router = useRouter();
  // ── Lookup ──
  const [q, setQ] = React.useState('');
  const [results, setResults] = React.useState<{ entries: TdsEntry[]; totals: { accrued: number; deposited: number; pending: number } } | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [sel, setSel] = React.useState<Set<string>>(new Set());
  const [challan, setChallan] = React.useState('');
  // Kept, not discarded — a batch "mark deposited" must not fire twice.
  const [pending, start] = React.useTransition();

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
      if (results) lookup(); else router.refresh();
    });
  }

  // ── Manual entry ──
  //
  // Rent, professional fees, commission, and anything paid to somebody who is not
  // on the vendor master: all deductible, none of them enterable before this,
  // because every row on this screen had to arrive from the vendor ledger.
  const [recording, setRecording] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [entrySection, setEntrySection] = React.useState('194J');
  const [entryBase, setEntryBase] = React.useState('');
  const [entryTds, setEntryTds] = React.useState('');
  const entryRate = TDS_SECTIONS.find((s) => s.code === entrySection)?.rate ?? 0;
  const suggestedTds = Math.round(((Number(entryBase) || 0) * entryRate) / 100);

  function submitEntry(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    setSaving(true);
    start(async () => {
      const r = await recordTdsDeduction({
        partyName: fd.get('partyName'),
        section: entrySection,
        base: entryBase,
        rate: entryRate,
        tds: entryTds || suggestedTds,
        date: fd.get('date') || null,
        mode: fd.get('mode') || 'BANK_TRANSFER',
        bankName: fd.get('bankName') || null,
        reference: fd.get('reference') || null,
        narration: fd.get('narration') || null,
      });
      setSaving(false);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(`Recorded as ${r.number}`);
      setRecording(false); setEntryBase(''); setEntryTds('');
      router.refresh();
    });
  }

  // ── Calculator ──
  const [calcSection, setCalcSection] = React.useState('194C');
  const [calcAmount, setCalcAmount] = React.useState('');
  const [calcPan, setCalcPan] = React.useState(true);
  const calc = computeTds({ sectionCode: calcSection, base: Number(calcAmount) || 0, hasPan: calcPan });

  return (
    <div className="space-y-6">
      <Dialog open={recording} onOpenChange={setRecording}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle>Record a TDS deduction</DialogTitle></DialogHeader>
          <form onSubmit={submitEntry} className="space-y-4">
            <p className="text-xs text-muted-foreground">
              For a deduction that did not come from a vendor payment — rent, professional fees, commission, a one-off
              payee. This creates the payment voucher too, so the bank figure is the amount actually paid out, net of
              the deduction.
            </p>
            <div className="space-y-2"><Label htmlFor="tparty">Who was paid</Label><Input id="tparty" name="partyName" required placeholder="Landlord / consultant / broker" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tsec">Section</Label>
                <select id="tsec" value={entrySection} onChange={(e) => { setEntrySection(e.target.value); setEntryTds(''); }} className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                  {TDS_SECTIONS.map((s) => <option key={s.code} value={s.code}>{s.code} — {s.label}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label htmlFor="tdate">Date</Label><Input id="tdate" name="date" type="date" /></div>
              <div className="space-y-2">
                <Label htmlFor="tbase">Amount before TDS (₹)</Label>
                <Input id="tbase" value={entryBase} onChange={(e) => setEntryBase(e.target.value)} type="number" required inputMode="numeric" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ttds">TDS to deduct (₹)</Label>
                <Input id="ttds" value={entryTds} onChange={(e) => setEntryTds(e.target.value)} type="number" inputMode="numeric" placeholder={String(suggestedTds)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tmode">Paid by</Label>
                <select id="tmode" name="mode" defaultValue="BANK_TRANSFER" className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="UPI">UPI</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>
              <div className="space-y-2"><Label htmlFor="tbank">Bank</Label><Input id="tbank" name="bankName" placeholder="Kotak — current" /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="tref">Reference</Label><Input id="tref" name="reference" placeholder="Cheque no. / UTR / invoice" /></div>
            <div className="space-y-2"><Label htmlFor="tnarr">Narration</Label><Input id="tnarr" name="narration" placeholder="Office rent — July" /></div>
            <div className="rounded-md bg-muted/50 p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Statutory rate for {entrySection}</span><span className="font-medium">{entryRate}%</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Deduction</span><span className="font-semibold text-primary">{inr(Number(entryTds) || suggestedTds)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Actually paid out</span><span className="font-medium">{inr(Math.max(0, (Number(entryBase) || 0) - (Number(entryTds) || suggestedTds)))}</span></div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRecording(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Record deduction</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
            {canManage && <Button type="button" variant="outline" onClick={() => setRecording(true)}><Plus className="h-4 w-4" /> Record a deduction</Button>}
          </form>

          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{results ? `Ledger for “${q}”` : 'Recent deductions'}</span>
            <span className="text-xs text-muted-foreground">Accrued {inr(totals.accrued)} · Deposited {inr(totals.deposited)} · Pending {inr(totals.pending)}</span>
          </div>

          <RecordList empty={results ? 'No TDS entries for that account.' : 'No TDS deducted yet.'}>
            {shown.map((e) => (
              <TdsRow
                key={e.id} e={e} selected={sel.has(e.id)} onToggle={() => toggle(e.id)} selectable={canManage}
                onChanged={() => { if (results) lookup(); else router.refresh(); }}
              />
            ))}
          </RecordList>

          {canManage && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
              <span className="text-sm">{sel.size} selected</span>
              <Input value={challan} onChange={(e) => setChallan(e.target.value)} placeholder="Challan / BSR no." className="h-8 max-w-[200px]" />
              <Button size="sm" onClick={markDeposited} disabled={pending || sel.size === 0} className="gap-1"><Check className="h-4 w-4" /> {pending ? 'Marking…' : 'Mark deposited'}</Button>
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
