'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2, Play, RotateCcw } from 'lucide-react';
import { setUpChartOfAccounts, reverseJournal } from '@/server/actions/ledger';
import { cn } from '@/lib/utils/cn';

const inr = (n: number) =>
  n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

interface Row { code: string; name: string; type: string; isGroup: boolean; debit: number; credit: number; balance: number }
interface Entry {
  id: string; number: string; date: string; narration: string; status: string;
  sourceType: string | null; total: number;
  lines: Array<{ account: string; debit: number; credit: number }>;
}

export function LedgerView({
  canManage, accountCount, trial, pl, bs, from, entries,
}: {
  canManage: boolean;
  accountCount: number;
  trial: { rows: Row[]; totalDebit: number; totalCredit: number; balanced: boolean };
  pl: { income: Row[]; expense: Row[]; totalIncome: number; totalExpense: number; profit: number };
  bs: { assets: Row[]; liabilities: Row[]; equity: Row[]; totalAssets: number; totalLiabilities: number; totalEquity: number; retained: number; balanced: boolean; difference: number };
  from: string;
  entries: Entry[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'trial' | 'pl' | 'bs' | 'entries'>('trial');
  const [msg, setMsg] = useState<{ bad: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const setUp = () =>
    start(async () => {
      const r = await setUpChartOfAccounts();
      setMsg('error' in r ? { bad: true, text: r.error } : { bad: false, text: r.message });
      router.refresh();
    });

  if (accountCount === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <h2 className="font-display text-xl font-semibold">The books have not been opened yet</h2>
        <p className="mx-auto mt-2 max-w-prose text-sm text-muted-foreground">
          Setting up creates a chart of accounts for a real-estate development LLP — cash and bank,
          receivables, work in progress, GST both ways, and the cost heads you actually spend against.
          Nothing is posted; it only creates the accounts to post into.
        </p>
        {canManage ? (
          <button
            type="button" onClick={setUp} disabled={pending}
            className="focus-ring mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Set up the chart of accounts
          </button>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">Ask somebody with finance access to set this up.</p>
        )}
        {msg && <p className={cn('mt-3 text-sm', msg.bad ? 'text-destructive' : 'text-emerald-600')}>{msg.text}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/*
        * The balance check is the first thing on the page, not buried at the
        * bottom of the trial balance. If the books are out, nothing else on
        * this screen is worth reading.
        */}
      <div className={cn(
        'flex items-start gap-2 rounded-lg border p-3 text-sm',
        trial.balanced ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-destructive/40 bg-destructive/5',
      )}>
        {trial.balanced
          ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
        <span>
          {trial.balanced ? (
            <>The books balance. Debits and credits both come to <strong>{inr(trial.totalDebit)}</strong>.</>
          ) : (
            <>
              <strong className="text-destructive">The books do not balance.</strong> Debits {inr(trial.totalDebit)},
              credits {inr(trial.totalCredit)}. Something has been posted incorrectly — stop and find it before
              relying on anything else here.
            </>
          )}
        </span>
      </div>

      <div className="chip-row">
        {([['trial', 'Trial balance'], ['pl', 'Profit & loss'], ['bs', 'Balance sheet'], ['entries', 'Entries']] as const).map(([k, l]) => (
          <button
            key={k} type="button" onClick={() => setTab(k)}
            className={cn(
              'focus-ring shrink-0 rounded-full border px-3 py-1 text-xs font-medium',
              tab === k ? 'border-primary bg-primary/10 text-primary' : 'border-border',
            )}
          >{l}</button>
        ))}
      </div>

      {msg && <p className={cn('text-sm', msg.bad ? 'text-destructive' : 'text-emerald-600')}>{msg.text}</p>}

      {tab === 'trial' && (
        <Table
          head={['Code', 'Account', 'Debit', 'Credit']}
          rows={trial.rows.filter((r) => r.debit || r.credit || r.isGroup)}
          foot={['', 'Total', inr(trial.totalDebit), inr(trial.totalCredit)]}
          render={(r) => [r.code, r.name, r.debit ? inr(r.debit) : '', r.credit ? inr(r.credit) : '']}
          bold={(r) => r.isGroup}
        />
      )}

      {tab === 'pl' && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            From {new Date(from).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} — the Indian financial year.
          </p>
          <Table head={['Code', 'Income', '', 'Amount']} rows={pl.income} foot={['', 'Total income', '', inr(pl.totalIncome)]}
            render={(r) => [r.code, r.name, '', inr(r.balance)]} />
          <Table head={['Code', 'Expenses', '', 'Amount']} rows={pl.expense} foot={['', 'Total expenses', '', inr(pl.totalExpense)]}
            render={(r) => [r.code, r.name, '', inr(r.balance)]} />
          <p className="rounded-lg border border-border bg-card p-4 text-sm">
            <span className="text-muted-foreground">{pl.profit >= 0 ? 'Profit' : 'Loss'} for the period: </span>
            <strong className={pl.profit >= 0 ? 'text-emerald-600' : 'text-destructive'}>{inr(Math.abs(pl.profit))}</strong>
          </p>
        </div>
      )}

      {tab === 'bs' && (
        <div className="space-y-4">
          {!bs.balanced && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              The balance sheet is out by {inr(Math.abs(bs.difference))}. This should never happen while the
              trial balance is in agreement — it means an account is set to the wrong type.
            </p>
          )}
          <Table head={['Code', 'Assets', '', 'Amount']} rows={bs.assets} foot={['', 'Total assets', '', inr(bs.totalAssets)]}
            render={(r) => [r.code, r.name, '', inr(r.balance)]} />
          <Table head={['Code', 'Liabilities', '', 'Amount']} rows={bs.liabilities} foot={['', 'Total liabilities', '', inr(bs.totalLiabilities)]}
            render={(r) => [r.code, r.name, '', inr(r.balance)]} />
          <Table head={['Code', 'Capital', '', 'Amount']} rows={bs.equity}
            foot={['', 'Capital and retained', '', inr(bs.totalEquity + bs.retained)]}
            render={(r) => [r.code, r.name, '', inr(r.balance)]} />
        </div>
      )}

      {tab === 'entries' && (
        <div className="space-y-3">
          {!entries.length && <p className="text-sm text-muted-foreground">Nothing has been posted yet.</p>}
          {entries.map((e) => (
            <article key={e.id} className={cn('rounded-lg border border-border bg-card p-4', e.status === 'REVERSED' && 'opacity-60')}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">
                  {e.number}
                  {e.status === 'REVERSED' && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px]">Reversed</span>}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {e.sourceType && ` · from ${e.sourceType}`}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{e.narration}</p>
              <ul className="mt-2 space-y-0.5 text-xs">
                {e.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className={cn('min-w-0 truncate', l.credit > 0 && 'pl-6')}>{l.account}</span>
                    <span className="tabular-nums">{l.debit ? inr(l.debit) : inr(l.credit)}</span>
                  </li>
                ))}
              </ul>
              {canManage && e.status === 'POSTED' && (
                <ReverseButton id={e.id} onDone={(m, bad) => { setMsg({ text: m, bad }); router.refresh(); }} />
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ReverseButton({ id, onDone }: { id: string; onDone: (m: string, bad: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button" onClick={() => setOpen(true)}
        className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1 text-xs"
      ><RotateCcw className="h-3.5 w-3.5" />Reverse</button>
    );
  }
  return (
    <div className="mt-3 space-y-2 rounded-md border border-border bg-muted/40 p-2">
      <p className="text-xs text-muted-foreground">
        The original stays exactly as it is; an opposite entry is posted alongside it. Say why — it goes in the books.
      </p>
      <input
        value={reason} onChange={(e) => setReason(e.target.value)}
        placeholder="Posted to the wrong head"
        className="focus-ring w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
      />
      <div className="flex gap-2">
        <button
          type="button" disabled={pending || reason.trim().length < 3}
          className="focus-ring rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground disabled:opacity-60"
          onClick={() => start(async () => {
            const r = await reverseJournal(id, reason);
            onDone('error' in r ? r.error : r.message, 'error' in r);
            setOpen(false);
          })}
        >{pending ? 'Reversing…' : 'Reverse it'}</button>
        <button type="button" onClick={() => setOpen(false)} className="focus-ring rounded-md border border-input px-2.5 py-1 text-xs">Cancel</button>
      </div>
    </div>
  );
}

function Table<T>({ head, rows, foot, render, bold }: {
  head: string[]; rows: T[]; foot?: string[];
  render: (r: T) => Array<string | number>; bold?: (r: T) => boolean;
}) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">Nothing here yet.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>{head.map((h, i) => <th key={i} className={cn('px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground', i > 1 && 'text-right')}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cn('border-t border-border', bold?.(r) && 'bg-muted/30 font-medium')}>
              {render(r).map((c, j) => <td key={j} className={cn('px-3 py-1.5', j > 1 && 'text-right tabular-nums')}>{c}</td>)}
            </tr>
          ))}
        </tbody>
        {foot && (
          <tfoot className="border-t-2 border-border bg-muted/50 font-semibold">
            <tr>{foot.map((c, i) => <td key={i} className={cn('px-3 py-2', i > 1 && 'text-right tabular-nums')}>{c}</td>)}</tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
