'use client';

import { useMemo, useState } from 'react';
import { Search, Download, Phone, AlertTriangle } from 'lucide-react';
import type { DueRow } from '@/server/services/receivables-service';

const inr = (n: number) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : 'no date set');

const BUCKET_TONE: Record<string, string> = {
  'not-due': 'text-muted-foreground',
  '0-30': 'text-amber-700 dark:text-amber-500',
  '31-60': 'text-orange-700 dark:text-orange-500',
  '61-90': 'text-destructive',
  '90+': 'text-destructive font-semibold',
};

export function ReceivablesView({
  rows, totalOutstanding, totalOverdue, dueThisMonth, buckets, topDebtors,
}: {
  rows: DueRow[];
  totalOutstanding: number; totalOverdue: number; dueThisMonth: number;
  buckets: Array<{ key: string; label: string; amount: number; count: number }>;
  topDebtors: Array<{ buyer: string; amount: number; oldestDays: number; phone: string | null }>;
}) {
  const [q, setQ] = useState('');
  const [bucket, setBucket] = useState<string | null>(null);

  const shown = useMemo(() => {
    let list = rows;
    if (bucket) list = list.filter((r) => r.bucket === bucket);
    const n = q.trim().toLowerCase();
    if (n) list = list.filter((r) => `${r.buyer} ${r.unit ?? ''} ${r.bookingRef} ${r.label}`.toLowerCase().includes(n));
    return [...list].sort((a, b) => b.daysLate - a.daysLate || b.amount - a.amount);
  }, [rows, q, bucket]);

  const csv = () => {
    const head = ['Buyer', 'Phone', 'Booking', 'Unit', 'Instalment', 'Amount', 'Due', 'Days late'];
    const body = shown.map((r) => [r.buyer, r.buyerPhone ?? '', r.bookingRef, r.unit ?? '', r.label, r.amount, day(r.dueDate), r.daysLate > 0 ? r.daysLate : 0]);
    const text = [head, ...body].map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `money-owed-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed p-10 text-center">
        <p className="font-medium">Nothing is outstanding.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Either every instalment is paid, or no payment schedules have been imported yet.
          Admin → Import Data → Milestones is where they go.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Outstanding in total" value={inr(totalOutstanding)} />
        <Stat label="Already overdue" value={inr(totalOverdue)} tone={totalOverdue > 0 ? 'bad' : undefined} hint={`${rows.filter((r) => r.daysLate > 0).length} instalments past their date`} />
        <Stat label="Falls due this month" value={inr(dueThisMonth)} hint="Not late yet — collect before it becomes a problem" />
      </div>

      <div className="card-elevated p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">How old the money is</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {buckets.map((b) => (
            <button
              key={b.key} type="button"
              onClick={() => setBucket(bucket === b.key ? null : b.key)}
              className={`focus-ring rounded-lg border p-3 text-left transition-colors ${bucket === b.key ? 'border-primary bg-secondary/60' : 'hover:bg-muted/50'}`}
            >
              <p className="text-xs text-muted-foreground">{b.label}</p>
              <p className={`mt-1 text-base font-semibold tabular-nums ${BUCKET_TONE[b.key]}`}>{inr(b.amount)}</p>
              <p className="text-xs text-muted-foreground">{b.count} instalment{b.count === 1 ? '' : 's'}</p>
            </button>
          ))}
        </div>
        {bucket && <p className="mt-2 text-xs text-muted-foreground">Showing one bucket — tap it again to see everything.</p>}
      </div>

      {topDebtors.length > 1 && (
        <div className="card-elevated p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Who owes the most</p>
          <ul className="mt-2 divide-y">
            {topDebtors.slice(0, 5).map((d) => (
              <li key={d.buyer} className="flex flex-wrap items-center gap-2 py-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.buyer}</span>
                {d.oldestDays > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3 w-3" />{d.oldestDays} days late
                  </span>
                )}
                {d.phone && (
                  <a href={`tel:${d.phone}`} className="focus-ring inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted">
                    <Phone className="h-3 w-3" />Call
                  </a>
                )}
                <span className="w-28 text-right text-sm font-semibold tabular-nums">{inr(d.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search a buyer, unit or booking…"
            className="focus-ring w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>
        <button type="button" onClick={csv} className="focus-ring rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted">
          <Download className="mr-1.5 inline h-4 w-4" />Export {shown.length}
        </button>
      </div>

      <div className="card-elevated divide-y">
        {shown.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {r.buyer}
                {r.unit && <span className="font-normal text-muted-foreground"> · {r.unit}</span>}
              </p>
              <p className="truncate text-sm text-muted-foreground">{r.label} · {r.bookingRef}</p>
            </div>
            <div className="text-right">
              <p className="font-semibold tabular-nums">{inr(r.amount)}</p>
              <p className={`text-xs ${BUCKET_TONE[r.bucket]}`}>
                {r.daysLate > 0 ? `${r.daysLate} days late` : `due ${day(r.dueDate)}`}
              </p>
            </div>
            {r.buyerPhone && (
              <a href={`tel:${r.buyerPhone}`} aria-label={`Call ${r.buyer}`} className="focus-ring rounded-md border p-2 hover:bg-muted">
                <Phone className="h-4 w-4" />
              </a>
            )}
          </div>
        ))}
        {shown.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">Nothing matches.</p>}
      </div>
    </div>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: 'bad'; hint?: string }) {
  return (
    <div className="card-elevated p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === 'bad' ? 'text-destructive' : ''}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
