'use client';

import * as React from 'react';
import type { SandboxData } from '@/server/services/sandbox-service';
import { sandboxAddEntry } from '@/server/actions/sandbox';
import { PageHead, ResetButton, useRunner, inr, Kpi } from './demo-shared';

const ACCOUNTS = ['Bank', 'Cash', 'Advance from Customers', 'Material Purchase', 'Sundry Creditors', 'Construction WIP', 'Marketing Expense', 'Salaries'];

/**
 * The demo's books. Real double-entry: every posting debits one account and
 * credits another by the same amount, and the trial balance below proves the
 * two sides match — the same rule the live Ameya Tally enforces.
 */
export function DemoBooks({ data }: { data: SandboxData }) {
  const [pending, run] = useRunner();
  const [f, setF] = React.useState({ narration: '', debitAcc: 'Bank', creditAcc: 'Advance from Customers', amount: '', date: '' });

  // Trial balance, built from the entries.
  const balances = React.useMemo(() => {
    const m = new Map<string, { dr: number; cr: number }>();
    for (const e of data.entries) {
      const d = m.get(e.debitAcc) ?? { dr: 0, cr: 0 }; d.dr += e.amount; m.set(e.debitAcc, d);
      const c = m.get(e.creditAcc) ?? { dr: 0, cr: 0 }; c.cr += e.amount; m.set(e.creditAcc, c);
    }
    return [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data.entries]);

  const totalDr = balances.reduce((s, b) => s + b.dr, 0);
  const totalCr = balances.reduce((s, b) => s + b.cr, 0);
  const balanced = Math.round(totalDr * 100) === Math.round(totalCr * 100);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run(() => sandboxAddEntry(f), 'Entry posted');
    setF({ ...f, narration: '', amount: '' });
  };

  return (
    <div>
      <PageHead title="Ameya Tally — demo books" blurb="Post a journal entry and watch both sides balance.">
        <ResetButton />
      </PageHead>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi label="Entries posted" value={String(data.entries.length)} />
        <Kpi label="Total debits" value={inr(totalDr)} />
        <Kpi label="Total credits" value={inr(totalCr)} hint={balanced ? 'Books balance' : 'Out of balance'} />
      </div>

      <form onSubmit={submit} className="mb-5 grid gap-2 rounded-lg border bg-secondary/30 p-3 sm:grid-cols-2 lg:grid-cols-6">
        <input required value={f.narration} onChange={(e) => setF({ ...f, narration: e.target.value })} placeholder="What is this for?" className="rounded-md border bg-background px-2 py-1.5 text-sm lg:col-span-2" />
        <select value={f.debitAcc} onChange={(e) => setF({ ...f, debitAcc: e.target.value })} aria-label="Debit account" className="rounded-md border bg-background px-2 py-1.5 text-sm">
          {ACCOUNTS.map((a) => <option key={a}>{a}</option>)}
        </select>
        <select value={f.creditAcc} onChange={(e) => setF({ ...f, creditAcc: e.target.value })} aria-label="Credit account" className="rounded-md border bg-background px-2 py-1.5 text-sm">
          {ACCOUNTS.map((a) => <option key={a}>{a}</option>)}
        </select>
        <input required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="Amount ₹" inputMode="numeric" className="rounded-md border bg-background px-2 py-1.5 text-sm" />
        <button type="submit" disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">Post entry</button>
        <p className="text-[11px] text-muted-foreground lg:col-span-6">
          The debit account receives the value; the credit account gives it up. Both sides always move by the same amount — that is what keeps the books balanced.
        </p>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Day book */}
        <div>
          <h2 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Day book</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="p-2">Date</th><th className="p-2">Narration</th><th className="p-2 text-right">Amount</th></tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="p-2 whitespace-nowrap text-muted-foreground">{e.date}</td>
                    <td className="p-2">
                      {e.narration}
                      <p className="text-[11px] text-muted-foreground">Dr {e.debitAcc} · Cr {e.creditAcc}</p>
                    </td>
                    <td className="p-2 text-right font-medium whitespace-nowrap">{inr(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trial balance */}
        <div>
          <h2 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Trial balance</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr><th className="p-2">Account</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th></tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr key={b.name} className="border-t">
                    <td className="p-2">{b.name}</td>
                    <td className="p-2 text-right">{b.dr ? inr(b.dr) : '—'}</td>
                    <td className="p-2 text-right">{b.cr ? inr(b.cr) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-secondary/30 font-medium">
                  <td className="p-2">Total</td>
                  <td className="p-2 text-right">{inr(totalDr)}</td>
                  <td className="p-2 text-right">{inr(totalCr)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className={`mt-1.5 text-xs ${balanced ? 'text-emerald-600' : 'text-destructive'}`}>
            {balanced ? '✓ Debits equal credits — the books balance.' : '✗ The two sides do not match.'}
          </p>
        </div>
      </div>
    </div>
  );
}
