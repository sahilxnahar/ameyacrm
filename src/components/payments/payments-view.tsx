'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Download, Search, ShieldCheck, ShieldAlert, Sparkles, Loader2, ChevronDown, GitMerge } from 'lucide-react';
import { recordUtr, readPaymentAdvice } from '@/server/actions/vouchers';
import { PAY_MODE_LABEL } from '@/config/vouchers';

export interface PaymentRow {
  id: string; number: string; kind: string; status: string; partyName: string;
  amount: number; mode: string; utr: string | null; bankName: string | null;
  reference: string | null; narration: string | null; paidOn: string; dated: string;
}

const inr = (n: number) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)}`;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });

export function PaymentsView({ payments, totalPaid, missingUtr }: { payments: PaymentRow[]; totalPaid: number; missingUtr: number }) {
  const [q, setQ] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [openParty, setOpenParty] = useState<string | null>(null);

  const parties = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number; last: string; missing: number; rows: PaymentRow[] }>();
    for (const p of payments) {
      if (p.status === 'CANCELLED') continue;
      const key = p.partyName.trim().toLowerCase();
      const e = map.get(key) ?? { name: p.partyName, total: 0, count: 0, last: p.paidOn, missing: 0, rows: [] };
      e.total += p.amount; e.count += 1; e.rows.push(p);
      if (p.paidOn > e.last) e.last = p.paidOn;
      if (!p.utr && p.mode !== 'CASH') e.missing += 1;
      map.set(key, e);
    }
    let list = [...map.values()].sort((a, b) => b.total - a.total);
    if (onlyMissing) list = list.filter((p) => p.missing > 0);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((p) =>
        p.name.toLowerCase().includes(needle) ||
        p.rows.some((r) => (r.utr ?? '').toLowerCase().includes(needle) || (r.narration ?? '').toLowerCase().includes(needle) || r.number.toLowerCase().includes(needle)),
      );
    }
    return list;
  }, [payments, q, onlyMissing]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total paid out" value={inr(totalPaid)} />
        <Stat label="People & vendors paid" value={String(new Set(payments.filter((p) => p.status !== 'CANCELLED').map((p) => p.partyName.toLowerCase())).size)} />
        <Stat
          label="Missing a UTR"
          value={String(missingUtr)}
          tone={missingUtr > 0 ? 'warn' : 'good'}
          hint={missingUtr > 0 ? 'Bank payments with no reference recorded' : 'Every bank payment is traceable'}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search a name, a UTR, a voucher number…"
            className="focus-ring w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <button
          type="button" onClick={() => setOnlyMissing((v) => !v)}
          className={`focus-ring rounded-md border px-3 py-2 text-sm ${onlyMissing ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
        >
          Missing UTR only
        </button>
        <a href="/api/reports/cash-book.csv" className="focus-ring rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted">
          <Download className="mr-1.5 inline h-4 w-4" />Export CSV
        </a>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <GitMerge className="h-3.5 w-3.5" />
        Same payee showing under different names (e.g. all the “Arun” / construction rows)?{' '}
        <Link href="/ledgers" className="font-medium text-primary hover:underline">Combine them in Vendor Ledgers → Tidy up payees</Link>
        {' '}— they’ll then appear here as one.
      </p>

      {parties.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing matches. Payments appear here as soon as you record a cash or bank payment.
        </p>
      ) : (
        <div className="space-y-2">
          {parties.map((p) => {
            const open = openParty === p.name;
            return (
              <div key={p.name} className="card-elevated overflow-hidden">
                <button
                  type="button" onClick={() => setOpenParty(open ? null : p.name)}
                  className="focus-ring flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
                >
                  <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.count} payment{p.count === 1 ? '' : 's'} · last on {day(p.last)}
                      {p.missing > 0 && <span className="ml-2 text-amber-700 dark:text-amber-500">{p.missing} without a UTR</span>}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">{inr(p.total)}</p>
                </button>
                {open && (
                  <div className="divide-y border-t">
                    {p.rows.map((r) => <PaymentLine key={r.id} row={r} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: 'warn' | 'good'; hint?: string }) {
  return (
    <div className="card-elevated p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === 'warn' ? 'text-amber-700 dark:text-amber-500' : ''}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PaymentLine({ row }: { row: PaymentRow }) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-xs text-muted-foreground">{row.number}</span>
        <span className="text-sm">{day(row.paidOn)}</span>
        <span className="text-sm text-muted-foreground">{PAY_MODE_LABEL[row.mode] ?? row.mode}</span>
        <span className="ml-auto font-medium tabular-nums">{inr(row.amount)}</span>
      </div>
      {row.narration && <p className="mt-1 text-sm text-muted-foreground">{row.narration}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {row.utr ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 font-mono text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
            <ShieldCheck className="h-3.5 w-3.5" />{row.utr}
          </span>
        ) : row.mode === 'CASH' ? (
          <span className="text-xs text-muted-foreground">Cash — no bank reference</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-500">
            <ShieldAlert className="h-3.5 w-3.5" />No UTR recorded
          </span>
        )}
        {row.status === 'CANCELLED' && <span className="text-xs font-medium text-destructive">Cancelled</span>}
        <button type="button" onClick={() => setEditing((v) => !v)} className="focus-ring rounded-md border px-2 py-1 text-xs hover:bg-muted">
          {row.utr ? 'Change UTR' : 'Add UTR'}
        </button>
        <Link href={`/api/vouchers/${row.id}/receipt`} target="_blank" className="focus-ring rounded-md border px-2 py-1 text-xs hover:bg-muted">
          <Download className="mr-1 inline h-3 w-3" />Receipt
        </Link>
      </div>
      {editing && <UtrForm row={row} onDone={() => setEditing(false)} />}
    </div>
  );
}

function UtrForm({ row, onDone }: { row: PaymentRow; onDone: () => void }) {
  const [utr, setUtr] = useState(row.utr ?? '');
  const [paidOn, setPaidOn] = useState(row.paidOn.slice(0, 10));
  const [bankName, setBankName] = useState(row.bankName ?? '');
  const [advice, setAdvice] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [reading, startRead] = useTransition();

  const save = () =>
    start(async () => {
      const res = await recordUtr({ id: row.id, utr, paidOn, bankName });
      if ('error' in res) setMsg({ kind: 'err', text: res.error });
      else { setMsg({ kind: 'ok', text: res.message ?? 'Saved.' }); setTimeout(onDone, 900); }
    });

  const read = () =>
    startRead(async () => {
      setMsg(null);
      const res = await readPaymentAdvice(advice);
      if ('error' in res) { setMsg({ kind: 'err', text: res.error }); return; }
      if (res.utr) setUtr(res.utr);
      if (res.paidOn) setPaidOn(res.paidOn);
      if (res.bankName) setBankName(res.bankName);
      const gap = res.amount && Math.abs(res.amount - row.amount) > 1
        ? ` The message says ₹${res.amount.toLocaleString('en-IN')} but this voucher is ${inr(row.amount)} — check which is right.`
        : '';
      setMsg({ kind: res.warning || gap ? 'err' : 'ok', text: (res.warning ?? 'Filled in from the message.') + gap });
    });

  return (
    <div className="mt-3 space-y-3 rounded-md border bg-muted/40 p-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground">Paste the bank SMS or UPI confirmation (optional)</label>
        <div className="mt-1 flex gap-2">
          <textarea
            value={advice} onChange={(e) => setAdvice(e.target.value)} rows={2}
            placeholder="Rs.3,50,000 debited from A/c XX8556 on 05-01-26 to SV… UTR: KKBKN52026…"
            className="focus-ring flex-1 rounded-md border bg-background p-2 text-xs"
          />
          <button
            type="button" onClick={read} disabled={reading || advice.trim().length < 10}
            className="focus-ring h-fit shrink-0 rounded-md border bg-background px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="mr-1 inline h-3.5 w-3.5" />Read it</>}
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">UTR / reference</span>
          <input value={utr} onChange={(e) => setUtr(e.target.value)} className="focus-ring mt-1 w-full rounded-md border bg-background px-2 py-1.5 font-mono text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Date paid</span>
          <input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} className="focus-ring mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-muted-foreground">Bank</span>
          <input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Kotak" className="focus-ring mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm" />
        </label>
      </div>

      {msg && <p className={`text-xs ${msg.kind === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-500'}`}>{msg.text}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={pending || utr.trim().length < 4} className="focus-ring rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50">
          {pending ? 'Saving…' : 'Save UTR'}
        </button>
        <button type="button" onClick={onDone} className="focus-ring rounded-md border px-3 py-1.5 text-xs hover:bg-muted">Cancel</button>
      </div>
    </div>
  );
}
