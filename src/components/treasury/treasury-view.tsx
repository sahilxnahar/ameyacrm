'use client';

import { useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, X, Upload, Landmark, TrendingDown, Link2, Ban } from 'lucide-react';
import {
  saveBankAccount, importStatement, confirmMatch, setLineStatus, saveLoan, addLoanEvent,
} from '@/server/actions/treasury';
import type { Forecast } from '@/lib/treasury/forecast';
import { readSpreadsheetAsCsv } from '@/lib/import/read-spreadsheet';
import { ImportDropzone } from '@/components/import/import-dropzone';
import { cn } from '@/lib/utils/cn';

const inr = (n: number) => n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const fmtDate = (d: Date | string | null) =>
  d == null ? '—' : new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

interface Position {
  id: string; name: string; bankName: string; accountLast4: string | null;
  openingBalance: number; movement: number; position: number; lineCount: number; unmatched: number;
}
interface ReconLine { id: string; bankAccountId: string; txnDate: Date; description: string; refNo: string | null; amount: number; }
interface Suggestion { lineId: string; voucherId: string; voucherNumber: string; partyName: string; confidence: string; amount: number; }
interface Loan {
  id: string; lender: string; kind: string; sanctionedAmount: number; interestRate: number | null;
  drawn: number; repaid: number; interestPaid: number; outstanding: number; isActive: boolean;
}

type Tab = 'position' | 'reconcile' | 'forecast' | 'loans';
type ActionResult = { ok: true; message: string; id?: string } | { error: string };

const inputCls = 'focus-ring mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm';
const primaryBtn = 'focus-ring inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60';

export function TreasuryView(props: {
  canManage: boolean;
  projects: Array<{ id: string; name: string }>;
  projectId: string | null;
  positions: Position[];
  forecast: Forecast & { horizonNote: string };
  loans: Loan[];
  activeAccountId: string | null;
  reconLines: ReconLine[];
  reconSuggestions: Suggestion[];
  candidateCount: number;
}) {
  const { canManage, projects, projectId, positions, forecast, loans, activeAccountId, reconLines, reconSuggestions, candidateCount } = props;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('position');
  const [msg, setMsg] = useState<{ bad: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [openForm, setOpenForm] = useState<string | null>(null);

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      const r = await fn();
      setMsg('error' in r ? { bad: true, text: r.error } : { bad: false, text: r.message });
      if (!('error' in r)) { setOpenForm(null); router.refresh(); }
    });

  const totalPosition = positions.reduce((s, p) => s + p.position, 0);
  const suggByLine = new Map(reconSuggestions.map((s) => [s.lineId, s]));

  return (
    <div className="space-y-4">
      {projects.length > 1 && (
        <div className="chip-row">
          <a href="/treasury" className={cn('focus-ring shrink-0 rounded-full border px-3 py-1 text-xs font-medium', projectId == null ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>All</a>
          {projects.map((p) => (
            <a key={p.id} href={`/treasury?project=${p.id}`} className={cn('focus-ring shrink-0 rounded-full border px-3 py-1 text-xs font-medium', p.id === projectId ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>{p.name}</a>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile icon={<Landmark className="h-4 w-4" />} label="Bank position" value={inr(totalPosition)} sub={`${positions.length} account${positions.length === 1 ? '' : 's'}`} />
        <Tile icon={<TrendingDown className="h-4 w-4" />} label="12-week low" value={inr(forecast.lowestPoint)} sub={forecast.lowestWeekIndex >= 0 ? `week ${forecast.lowestWeekIndex + 1}` : 'at opening'} bad={forecast.lowestPoint < 0} />
        <Tile icon={<Link2 className="h-4 w-4" />} label="To reconcile" value={String(positions.reduce((s, p) => s + p.unmatched, 0))} sub="unmatched lines" bad={positions.reduce((s, p) => s + p.unmatched, 0) > 0} />
        <Tile icon={<Landmark className="h-4 w-4" />} label="Loans outstanding" value={inr(loans.reduce((s, l) => s + l.outstanding, 0))} sub={`${loans.filter((l) => l.isActive).length} active`} />
      </div>

      <div className="flex gap-1 border-b border-border">
        {(['position', 'reconcile', 'forecast', 'loans'] as Tab[]).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={cn('focus-ring -mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize', tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>{t}</button>
        ))}
      </div>

      {msg && <p className={cn('text-sm', msg.bad ? 'text-destructive' : 'text-emerald-600')}>{msg.text}</p>}

      {tab === 'position' && (
        <PositionTab positions={positions} projects={projects} projectId={projectId} canManage={canManage}
          pending={pending} openForm={openForm} setOpenForm={setOpenForm} run={run} />
      )}
      {tab === 'reconcile' && (
        <ReconcileTab positions={positions} activeAccountId={activeAccountId} lines={reconLines} suggByLine={suggByLine}
          candidateCount={candidateCount} projectId={projectId} canManage={canManage} pending={pending} run={run} />
      )}
      {tab === 'forecast' && <ForecastTab forecast={forecast} />}
      {tab === 'loans' && (
        <LoansTab loans={loans} projects={projects} projectId={projectId} canManage={canManage}
          pending={pending} openForm={openForm} setOpenForm={setOpenForm} run={run} />
      )}
    </div>
  );
}

function Tile({ icon, label, value, sub, bad }: { icon: ReactNode; label: string; value: string; sub: string; bad?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className={cn('mt-1 font-display text-xl font-semibold', bad ? 'text-destructive' : '')}>{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

type RunFn = (fn: () => Promise<ActionResult>) => void;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs"><span className="text-muted-foreground">{label}</span>{children}</label>;
}
function AddButton({ open, onClick, label }: { open: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium">
      {open ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{open ? 'Close' : label}
    </button>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{text}</div>;
}

function PositionTab({ positions, projects, projectId, canManage, pending, openForm, setOpenForm, run }: {
  positions: Position[]; projects: Array<{ id: string; name: string }>; projectId: string | null; canManage: boolean;
  pending: boolean; openForm: string | null; setOpenForm: (v: string | null) => void; run: RunFn;
}) {
  const fileRef = useRef<HTMLTextAreaElement | null>(null);
  const onFile = (f: File) => {
    if (!fileRef.current) return;
    readSpreadsheetAsCsv(f).then((text) => { if (fileRef.current) fileRef.current.value = text; }).catch(() => undefined);
  };

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex flex-wrap gap-2">
          <AddButton open={openForm === 'account'} onClick={() => setOpenForm(openForm === 'account' ? null : 'account')} label="Add bank account" />
          {positions.length > 0 && <AddButton open={openForm === 'import'} onClick={() => setOpenForm(openForm === 'import' ? null : 'import')} label="Import statement" />}
        </div>
      )}

      {openForm === 'account' && canManage && (
        <form className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(() => saveBankAccount({
              name: f.get('name') as string, bankName: f.get('bankName') as string,
              accountLast4: (f.get('accountLast4') as string) || null, ifsc: (f.get('ifsc') as string) || null,
              openingBalance: f.get('openingBalance') ? Number(f.get('openingBalance')) : 0,
              projectId: (f.get('projectId') as string) || null,
            }));
          }}>
          <Field label="Account name *"><input name="name" required className={inputCls} /></Field>
          <Field label="Bank *"><input name="bankName" required className={inputCls} /></Field>
          <Field label="A/c last 4"><input name="accountLast4" maxLength={4} className={inputCls} /></Field>
          <Field label="IFSC"><input name="ifsc" className={inputCls} /></Field>
          <Field label="Opening balance (₹)"><input name="openingBalance" type="number" step="1" className={inputCls} /></Field>
          <Field label="Project (optional)">
            <select name="projectId" defaultValue={projectId ?? ''} className={inputCls}>
              <option value="">— none —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-3"><button type="submit" disabled={pending} className={primaryBtn}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save account</button></div>
        </form>
      )}

      {openForm === 'import' && canManage && positions.length > 0 && (
        <form className="space-y-3 rounded-lg border border-border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(() => importStatement({
              bankAccountId: f.get('bankAccountId') as string,
              fileName: (f.get('fileName') as string) || null,
              csv: (f.get('csv') as string) || '',
            }));
          }}>
          <Field label="Into account">
            <select name="bankAccountId" className={inputCls}>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.bankName}</option>)}
            </select>
          </Field>
          <ImportDropzone onFile={onFile} disabled={pending} title="Drag & drop your bank statement (CSV or Excel)" hint="or click to browse — or paste the rows below" />
          <input type="hidden" name="fileName" value="statement.csv" />
          <label className="block text-xs">
            <span className="text-muted-foreground">Statement CSV — Date, Description, and either an Amount column or Withdrawal/Deposit columns</span>
            <textarea ref={fileRef} name="csv" rows={6} className={cn(inputCls, 'font-mono text-xs')} placeholder="Date,Narration,Withdrawal,Deposit,Balance&#10;21/07/2026,NEFT UTR123456789,,150000,150000" />
          </label>
          <button type="submit" disabled={pending} className={primaryBtn}><Upload className="h-4 w-4" />{pending && <Loader2 className="h-4 w-4 animate-spin" />}Import</button>
        </form>
      )}

      {positions.length === 0 ? (
        <Empty text="No bank accounts yet. Add one, then import a statement — the lines match themselves against the UTRs already on your vouchers." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr className="text-left"><th className="p-2">Account</th><th className="p-2">Opening</th><th className="p-2">Movement</th><th className="p-2">Position</th><th className="p-2">Lines</th><th className="p-2">To reconcile</th></tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="p-2">{p.name}<span className="block text-xs text-muted-foreground">{p.bankName}{p.accountLast4 ? ` ••${p.accountLast4}` : ''}</span></td>
                  <td className="p-2">{inr(p.openingBalance)}</td>
                  <td className="p-2">{inr(p.movement)}</td>
                  <td className="p-2 font-medium">{inr(p.position)}</td>
                  <td className="p-2">{p.lineCount}</td>
                  <td className="p-2">{p.unmatched > 0 ? <span className="text-amber-600">{p.unmatched}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReconcileTab({ positions, activeAccountId, lines, suggByLine, candidateCount, projectId, canManage, pending, run }: {
  positions: Position[]; activeAccountId: string | null; lines: ReconLine[]; suggByLine: Map<string, Suggestion>;
  candidateCount: number; projectId: string | null; canManage: boolean; pending: boolean; run: RunFn;
}) {
  if (positions.length === 0) return <Empty text="Add a bank account and import a statement first." />;
  const q = projectId ? `&project=${projectId}` : '';
  return (
    <div className="space-y-3">
      <div className="chip-row">
        {positions.map((p) => (
          <a key={p.id} href={`/treasury?account=${p.id}${q}`} className={cn('focus-ring shrink-0 rounded-full border px-3 py-1 text-xs font-medium', p.id === activeAccountId ? 'border-primary bg-primary/10 text-primary' : 'border-border')}>{p.name} {p.unmatched > 0 ? `(${p.unmatched})` : ''}</a>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{candidateCount} unreconciled bank voucher{candidateCount === 1 ? '' : 's'} available to match against.</p>

      {lines.length === 0 ? (
        <Empty text="Nothing left to reconcile on this account." />
      ) : (
        <div className="space-y-2">
          {lines.map((l) => {
            const s = suggByLine.get(l.id);
            return (
              <div key={l.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={cn('font-medium', l.amount >= 0 ? 'text-emerald-600' : 'text-destructive')}>{l.amount >= 0 ? '+' : ''}{inr(l.amount)}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(l.txnDate)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{l.description}{l.refNo ? ` · ref ${l.refNo}` : ''}</p>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap items-center gap-2">
                      {s ? (
                        <>
                          <span className={cn('rounded-full px-2 py-0.5 text-xs', s.confidence === 'EXACT_UTR' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600')}>
                            {s.confidence === 'EXACT_UTR' ? 'UTR match' : 'likely'} · {s.voucherNumber} · {s.partyName}
                          </span>
                          <button type="button" disabled={pending} onClick={() => run(() => confirmMatch(l.id, s.voucherId, s.confidence))} className="focus-ring inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-60"><Link2 className="h-3.5 w-3.5" />Confirm</button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">no suggestion</span>
                      )}
                      <button type="button" disabled={pending} onClick={() => run(() => setLineStatus(l.id, 'IGNORED'))} className="focus-ring inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs"><Ban className="h-3.5 w-3.5" />Ignore</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ForecastTab({ forecast }: { forecast: Forecast & { horizonNote: string } }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-sm">
        <span>Opening: <strong>{inr(forecast.opening)}</strong></span>
        <span>Closing (12wk): <strong>{inr(forecast.closing)}</strong></span>
        <span className={forecast.lowestPoint < 0 ? 'text-destructive' : ''}>Lowest: <strong>{inr(forecast.lowestPoint)}</strong>{forecast.lowestWeekIndex >= 0 ? ` (week ${forecast.lowestWeekIndex + 1})` : ''}</span>
      </div>
      <p className="text-xs text-muted-foreground">{forecast.horizonNote} A negative lowest point means a payment run in that week would overdraw — act before it, while it is still cheap.</p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr className="text-left"><th className="p-2">Week</th><th className="p-2">Starting</th><th className="p-2">In</th><th className="p-2">Out</th><th className="p-2">Net</th><th className="p-2">Closing</th></tr>
          </thead>
          <tbody>
            {forecast.buckets.map((b) => (
              <tr key={b.index} className={cn('border-t border-border', b.closing < 0 ? 'bg-destructive/5' : '')}>
                <td className="p-2">W{b.index + 1}</td>
                <td className="p-2 text-xs text-muted-foreground">{fmtDate(b.weekStart)}</td>
                <td className="p-2 text-emerald-600">{b.inflow ? inr(b.inflow) : '—'}</td>
                <td className="p-2 text-destructive">{b.outflow ? inr(b.outflow) : '—'}</td>
                <td className="p-2">{inr(b.net)}</td>
                <td className={cn('p-2 font-medium', b.closing < 0 ? 'text-destructive' : '')}>{inr(b.closing)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoansTab({ loans, projects, projectId, canManage, pending, openForm, setOpenForm, run }: {
  loans: Loan[]; projects: Array<{ id: string; name: string }>; projectId: string | null; canManage: boolean;
  pending: boolean; openForm: string | null; setOpenForm: (v: string | null) => void; run: RunFn;
}) {
  return (
    <div className="space-y-3">
      {canManage && (
        <AddButton open={openForm === 'loan'} onClick={() => setOpenForm(openForm === 'loan' ? null : 'loan')} label="Add loan facility" />
      )}
      {openForm === 'loan' && canManage && (
        <form className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(() => saveLoan({
              lender: f.get('lender') as string, kind: (f.get('kind') as string) as never,
              sanctionedAmount: f.get('sanctionedAmount') ? Number(f.get('sanctionedAmount')) : 0,
              interestRate: f.get('interestRate') ? Number(f.get('interestRate')) : null,
              startedOn: (f.get('startedOn') as string) || null,
              projectId: (f.get('projectId') as string) || null,
            }));
          }}>
          <Field label="Lender *"><input name="lender" required className={inputCls} /></Field>
          <Field label="Kind">
            <select name="kind" defaultValue="TERM_LOAN" className={inputCls}>
              {['TERM_LOAN', 'OVERDRAFT', 'VENTURE_DEBT', 'PROJECT_LOAN', 'OTHER'].map((k) => <option key={k} value={k}>{k.replace(/_/g, ' ').toLowerCase()}</option>)}
            </select>
          </Field>
          <Field label="Sanctioned (₹)"><input name="sanctionedAmount" type="number" step="1" className={inputCls} /></Field>
          <Field label="Interest rate (%)"><input name="interestRate" type="number" step="0.001" className={inputCls} /></Field>
          <Field label="Started on"><input name="startedOn" type="date" className={inputCls} /></Field>
          <Field label="Project (optional)">
            <select name="projectId" defaultValue={projectId ?? ''} className={inputCls}>
              <option value="">— none —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-3"><button type="submit" disabled={pending} className={primaryBtn}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Save loan</button></div>
        </form>
      )}

      {loans.length === 0 ? (
        <Empty text="No loans on record. Track drawdowns, repayments and interest so outstanding is a number, not a guess." />
      ) : loans.map((l) => (
        <div key={l.id} className="rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <span className="font-medium">{l.lender}</span>
              <span className="ml-2 text-xs text-muted-foreground capitalize">{l.kind.replace(/_/g, ' ').toLowerCase()}{l.interestRate != null ? ` · ${l.interestRate}%` : ''}</span>
              <p className="mt-0.5 text-xs text-muted-foreground">Sanctioned {inr(l.sanctionedAmount)} · Drawn {inr(l.drawn)} · Repaid {inr(l.repaid)} · Interest {inr(l.interestPaid)}</p>
            </div>
            <span className={cn('rounded-full px-2 py-0.5 text-sm font-medium', l.outstanding > 0 ? 'bg-amber-500/10 text-amber-600' : 'bg-emerald-500/10 text-emerald-600')}>Outstanding {inr(l.outstanding)}</span>
          </div>
          {canManage && (
            <div className="mt-2">
              <button type="button" onClick={() => setOpenForm(openForm === `ev-${l.id}` ? null : `ev-${l.id}`)} className="text-xs text-primary underline-offset-2 hover:underline">Record drawdown / repayment / interest</button>
              {openForm === `ev-${l.id}` && (
                <form className="mt-2 flex flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    run(() => addLoanEvent({ loanId: l.id, kind: (f.get('kind') as string) as never, amount: Number(f.get('amount')), eventDate: (f.get('eventDate') as string) || null }));
                  }}>
                  <select name="kind" defaultValue="DRAWDOWN" className={cn(inputCls, 'w-36')}>
                    {['DRAWDOWN', 'REPAYMENT', 'INTEREST', 'FEE'].map((k) => <option key={k} value={k}>{k.toLowerCase()}</option>)}
                  </select>
                  <input name="amount" type="number" step="1" required placeholder="Amount" className={cn(inputCls, 'w-36')} />
                  <input name="eventDate" type="date" className={cn(inputCls, 'w-40')} />
                  <button type="submit" disabled={pending} className="focus-ring rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60">Record</button>
                </form>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
