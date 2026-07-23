'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, X, Landmark, ShieldCheck, TrendingUp, AlertTriangle } from 'lucide-react';
import { saveInvestor, addInvestorTransaction, saveCapitalEntry, recordEscrowMovement, saveCovenant, generateReraComplianceReport } from '@/server/actions/capital';
import type { EscrowPosition, CovenantStatus } from '@/lib/capital/escrow';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

const inr = (n: number | null) => n == null ? '—' : n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

interface Overview {
  projectId: string | null;
  investors: Array<{ id: string; name: string; contact: string | null; commitment: number; drawn: number; distributed: number; unitsAllotted: number; outstanding: number }>;
  totalCommitment: number; totalDrawn: number;
  stack: Array<{ id: string; kind: string; source: string; amount: number; costPct: number | null }>;
  stackTotal: number;
  escrow: EscrowPosition;
  latestCertifiedPct: number;
  covenants: Array<CovenantStatus & { id: string; unit: string | null }>;
  breachedCovenants: number;
}
type Tab = 'stack' | 'investors' | 'escrow' | 'covenants';
type Res = { ok: true; message: string; id?: string } | { error: string };

const inputCls = 'focus-ring mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm';
const primaryBtn = 'focus-ring inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60';

export function CapitalView({ canManage, projects, projectId, overview }: { canManage: boolean; projects: Array<{ id: string; name: string }>; projectId: string | null; overview: Overview }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('stack');
  const [msg, setMsg] = useState<{ bad: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [openForm, setOpenForm] = useState<string | null>(null);
  const run = (fn: () => Promise<Res>) => start(async () => { const r = await fn(); setMsg('error' in r ? { bad: true, text: r.error } : { bad: false, text: r.message }); if (!('error' in r)) { setOpenForm(null); router.refresh(); } });
  const downloadReraReport = () => start(async () => {
    const r = await generateReraComplianceReport(projectId);
    if ('error' in r) { setMsg({ bad: true, text: r.error }); return; }
    const a = document.createElement('a'); a.href = `data:application/pdf;base64,${r.pdfBase64}`; a.download = r.filename; a.click();
    setMsg({ bad: false, text: 'RERA compliance statement downloaded.' });
  });

  const e = overview.escrow;

  return (
    <div className="space-y-4">
      {projects.length > 1 && (
        <div className="chip-row">
          {projects.map((p) => <a key={p.id} href={`/capital?project=${p.id}`} className={cn('focus-ring shrink-0 rounded-full border px-3 py-1 text-xs font-medium', p.id === projectId ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>{p.name}</a>)}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile icon={<Landmark className="h-4 w-4" />} label="Capital stack" value={inr(overview.stackTotal)} sub={`${overview.stack.length} sources`} />
        <Tile icon={<TrendingUp className="h-4 w-4" />} label="Investor commitment" value={inr(overview.totalCommitment)} sub={`${inr(overview.totalDrawn)} drawn`} />
        <Tile icon={<ShieldCheck className="h-4 w-4" />} label="Escrow balance" value={inr(e.balance)} sub={e.depositShortfall > 0 ? `${inr(e.depositShortfall)} short` : 'fully funded'} bad={e.depositShortfall > 0 || e.overWithdrawn} />
        <Tile icon={<AlertTriangle className="h-4 w-4" />} label="Covenants breached" value={String(overview.breachedCovenants)} sub={`${overview.covenants.length} monitored`} bad={overview.breachedCovenants > 0} />
      </div>

      <div className="flex gap-1 border-b border-border">
        {(['stack', 'investors', 'escrow', 'covenants'] as Tab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={cn('focus-ring -mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize', tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>{t === 'stack' ? 'Capital Stack' : t}</button>
        ))}
      </div>

      {msg && <p className={cn('text-sm', msg.bad ? 'text-destructive' : 'text-emerald-600')}>{msg.text}</p>}

      {tab === 'stack' && (
        <div className="space-y-3">
          {canManage && projectId && <AddBtn open={openForm === 'cap'} onClick={() => setOpenForm(openForm === 'cap' ? null : 'cap')} label="Add capital source" />}
          {openForm === 'cap' && canManage && projectId && (
            <form className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3" onSubmit={(ev) => { ev.preventDefault(); const f = new FormData(ev.currentTarget); run(() => saveCapitalEntry({ projectId, kind: (f.get('kind') as string) as never, source: f.get('source') as string, amount: Number(f.get('amount') || 0), costPct: f.get('costPct') ? Number(f.get('costPct')) : null })); }}>
              <Field label="Kind"><select name="kind" defaultValue="EQUITY" className={inputCls}>{['EQUITY', 'DEBT', 'BUYER_ADVANCE', 'MEZZANINE', 'OTHER'].map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ').toLowerCase()}</option>)}</select></Field>
              <Field label="Source *"><input name="source" required className={inputCls} /></Field>
              <Field label="Amount (₹)"><input name="amount" type="number" step="1" className={inputCls} /></Field>
              <Field label="Cost of capital (%)"><input name="costPct" type="number" step="0.001" className={inputCls} /></Field>
              <div className="sm:col-span-3"><button type="submit" disabled={pending} className={primaryBtn}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save</button></div>
            </form>
          )}
          {overview.stack.length === 0 ? <Empty text="No capital sources yet. Add equity, debt and buyer advances to see the stack." /> : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground"><tr className="text-left"><th className="p-2">Kind</th><th className="p-2">Source</th><th className="p-2">Amount</th><th className="p-2">Share</th><th className="p-2">Cost</th></tr></thead>
                <tbody>
                  {overview.stack.map((s) => <tr key={s.id} className="border-t border-border"><td className="p-2 capitalize">{s.kind.replace(/_/g, ' ').toLowerCase()}</td><td className="p-2">{s.source}</td><td className="p-2 font-medium">{inr(s.amount)}</td><td className="p-2">{overview.stackTotal > 0 ? Math.round((s.amount / overview.stackTotal) * 100) : 0}%</td><td className="p-2">{s.costPct != null ? `${s.costPct}%` : '—'}</td></tr>)}
                  <tr className="border-t border-border font-medium"><td className="p-2" colSpan={2}>Total</td><td className="p-2">{inr(overview.stackTotal)}</td><td className="p-2">100%</td><td className="p-2" /></tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'investors' && (
        <div className="space-y-3">
          {canManage && <AddBtn open={openForm === 'inv'} onClick={() => setOpenForm(openForm === 'inv' ? null : 'inv')} label="Add investor" />}
          {openForm === 'inv' && canManage && (
            <form className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3" onSubmit={(ev) => { ev.preventDefault(); const f = new FormData(ev.currentTarget); run(() => saveInvestor({ projectId, name: f.get('name') as string, contact: (f.get('contact') as string) || null, commitment: Number(f.get('commitment') || 0) })); }}>
              <Field label="Name *"><input name="name" required className={inputCls} /></Field>
              <Field label="Contact"><input name="contact" className={inputCls} /></Field>
              <Field label="Commitment (₹)"><input name="commitment" type="number" step="1" className={inputCls} /></Field>
              <div className="sm:col-span-3"><button type="submit" disabled={pending} className={primaryBtn}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save investor</button></div>
            </form>
          )}
          {overview.investors.length === 0 ? <Empty text="No investors yet." /> : overview.investors.map((inv) => (
            <div key={inv.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><span className="font-medium">{inv.name}</span>{inv.contact ? <span className="ml-2 text-xs text-muted-foreground">{inv.contact}</span> : null}
                  <p className="mt-0.5 text-xs text-muted-foreground">Commitment {inr(inv.commitment)} · drawn {inr(inv.drawn)} · outstanding {inr(inv.outstanding)}{inv.unitsAllotted ? ` · ${inv.unitsAllotted} units` : ''}</p>
                </div>
                {canManage && <button type="button" onClick={() => setOpenForm(openForm === `tx-${inv.id}` ? null : `tx-${inv.id}`)} className="text-xs text-primary hover:underline">Record transaction</button>}
              </div>
              {openForm === `tx-${inv.id}` && canManage && (
                <form className="mt-2 flex flex-wrap gap-2" onSubmit={(ev) => { ev.preventDefault(); const f = new FormData(ev.currentTarget); run(() => addInvestorTransaction({ investorId: inv.id, kind: (f.get('kind') as string) as never, amount: Number(f.get('amount')), unitsAllotted: f.get('units') ? Number(f.get('units')) : null })); }}>
                  <select name="kind" defaultValue="DRAWDOWN" className={cn(inputCls, 'w-36 mt-0')}>{['COMMITMENT', 'DRAWDOWN', 'DISTRIBUTION', 'REPAYMENT'].map((v) => <option key={v} value={v}>{v.toLowerCase()}</option>)}</select>
                  <input name="amount" type="number" step="1" required placeholder="Amount" className={cn(inputCls, 'w-32 mt-0')} />
                  <input name="units" type="number" placeholder="Units" className={cn(inputCls, 'w-24 mt-0')} />
                  <button type="submit" disabled={pending} className="focus-ring rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">Record</button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'escrow' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Tile label="Buyer receipts" value={inr(e.totalReceipts)} sub={`${e.escrowPct}% must be ring-fenced`} />
            <Tile label="Required in escrow" value={inr(e.requiredDeposit)} sub={e.depositShortfall > 0 ? `${inr(e.depositShortfall)} short` : 'met'} bad={e.depositShortfall > 0} />
            <Tile label="Balance" value={inr(e.balance)} sub={`${inr(e.deposited)} in · ${inr(e.withdrawn)} out`} />
            <Tile label="Withdrawable now" value={inr(e.withdrawable)} sub={`at ${overview.latestCertifiedPct}% certified`} />
          </div>
          {e.overWithdrawn && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">Withdrawals have exceeded the certified entitlement — this is a RERA breach to correct.</div>}
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={downloadReraReport} disabled={pending} className="focus-ring inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-secondary disabled:opacity-60">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Download RERA 70:30 compliance statement
            </button>
          </div>
          {canManage && projectId && <AddBtn open={openForm === 'esc'} onClick={() => setOpenForm(openForm === 'esc' ? null : 'esc')} label="Record escrow movement" />}
          {openForm === 'esc' && canManage && projectId && (
            <form className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3" onSubmit={(ev) => { ev.preventDefault(); const f = new FormData(ev.currentTarget); run(() => recordEscrowMovement({ projectId, kind: (f.get('kind') as string) as never, amount: Number(f.get('amount') || 0), certifiedPct: f.get('certifiedPct') ? Number(f.get('certifiedPct')) : null, reference: (f.get('reference') as string) || null })); }}>
              <Field label="Kind"><select name="kind" defaultValue="DEPOSIT" className={inputCls}>{['DEPOSIT', 'WITHDRAWAL'].map((v) => <option key={v} value={v}>{v.toLowerCase()}</option>)}</select></Field>
              <Field label="Amount (₹)"><input name="amount" type="number" step="1" required className={inputCls} /></Field>
              <Field label="Certified % (for withdrawals)"><input name="certifiedPct" type="number" min="0" max="100" step="0.01" className={inputCls} /></Field>
              <Field label="Reference (UTR/cert no.)"><input name="reference" className={inputCls} /></Field>
              <div className="sm:col-span-3"><button type="submit" disabled={pending} className={primaryBtn}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Record movement</button></div>
            </form>
          )}
          <p className="text-xs text-muted-foreground">A withdrawal is refused if it exceeds the balance or the certified-progress entitlement. The certified percentage is captured against each withdrawal as evidence.</p>
        </div>
      )}

      {tab === 'covenants' && (
        <div className="space-y-3">
          {canManage && <AddBtn open={openForm === 'cov'} onClick={() => setOpenForm(openForm === 'cov' ? null : 'cov')} label="Add covenant" />}
          {openForm === 'cov' && canManage && (
            <form className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3" onSubmit={(ev) => { ev.preventDefault(); const f = new FormData(ev.currentTarget); run(() => saveCovenant({ projectId, name: f.get('name') as string, loanRef: (f.get('loanRef') as string) || null, direction: (f.get('direction') as string) as never, threshold: Number(f.get('threshold')), current: Number(f.get('current')), unit: (f.get('unit') as string) || null })); }}>
              <Field label="Covenant *"><input name="name" required placeholder="DSCR, LTV, Interest cover…" className={inputCls} /></Field>
              <Field label="Lender / loan ref"><input name="loanRef" className={inputCls} /></Field>
              <Field label="Direction"><select name="direction" defaultValue="MIN" className={inputCls}><option value="MIN">must stay ≥ (min)</option><option value="MAX">must stay ≤ (max)</option></select></Field>
              <Field label="Threshold"><input name="threshold" type="number" step="0.0001" required className={inputCls} /></Field>
              <Field label="Current value"><input name="current" type="number" step="0.0001" required className={inputCls} /></Field>
              <Field label="Unit"><input name="unit" placeholder="x, %, ₹Cr" className={inputCls} /></Field>
              <div className="sm:col-span-3"><button type="submit" disabled={pending} className={primaryBtn}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save covenant</button></div>
            </form>
          )}
          {overview.covenants.length === 0 ? <Empty text="No covenants monitored. Add the ratios you've promised a lender to get a warning before a breach." /> : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground"><tr className="text-left"><th className="p-2">Covenant</th><th className="p-2">Rule</th><th className="p-2">Current</th><th className="p-2">Headroom</th><th className="p-2">Status</th></tr></thead>
                <tbody>
                  {overview.covenants.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="p-2">{c.name}</td>
                      <td className="p-2 text-xs text-muted-foreground">{c.direction === 'MIN' ? '≥' : '≤'} {c.threshold}{c.unit ? ` ${c.unit}` : ''}</td>
                      <td className="p-2">{c.current}{c.unit ? ` ${c.unit}` : ''}</td>
                      <td className={cn('p-2', c.headroom < 0 ? 'text-destructive' : '')}>{c.headroom}</td>
                      <td className="p-2">{c.breached ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">breached</span> : c.nearBreach ? <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">near breach</span> : <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600">ok</span>}</td>
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

function Tile({ icon, label, value, sub, bad }: { icon?: ReactNode; label: string; value: string; sub: string; bad?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className={cn('mt-1 font-display text-lg font-semibold', bad ? 'text-destructive' : '')}>{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block text-xs"><span className="text-muted-foreground">{label}</span>{children}</label>; }
function AddBtn({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) { return <button type="button" onClick={onClick} className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium">{open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{open ? 'Close' : label}</button>; }
function Empty({ text }: { text: string }) { return <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>; }
