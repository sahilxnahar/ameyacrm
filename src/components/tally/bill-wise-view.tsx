'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { ChevronDown, Plus } from 'lucide-react';
import { AGEING_BUCKETS, type BillWiseReport, type PartyAgeing, type BucketKey } from '@/lib/tally/bills-shared';
import { createTallyBill } from '@/server/actions/tally-bills';
import { PartyReminderPanel } from './party-reminder-panel';

/**
 * Bill-wise outstanding, with ageing.
 *
 * The difference from the old report matters commercially. That one matched
 * payments to charges oldest-first and inferred what was overdue; this shows
 * what money was actually set against which bill. A buyer paying the third
 * instalment while disputing the second used to appear as having settled the
 * second — so the genuinely overdue amount hid, and nobody chased it.
 */
const inr = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

export function BillWiseView({
  report, ledgers, onBack, onRefresh,
}: {
  report: BillWiseReport | null;
  ledgers: Array<{ id: string; name: string; group: string }>;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const [side, setSide] = React.useState<'RECEIVABLE' | 'PAYABLE'>('RECEIVABLE');
  const [adding, setAdding] = React.useState(false);
  const [pending, start] = React.useTransition();

  if (!report) return <p className="p-6 text-center text-sm text-[#5B4412]">Loading…</p>;

  const parties = side === 'RECEIVABLE' ? report.receivables : report.payables;
  const buckets = side === 'RECEIVABLE' ? report.totals.receivableBuckets : report.totals.payableBuckets;
  const total = side === 'RECEIVABLE' ? report.totals.receivable : report.totals.payable;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Bill-wise outstanding</h2>
          <p className="mt-0.5 text-[11px] text-[#5B4412]">
            What is owed, bill by bill, aged from each bill’s due date. As at {report.asAt}.
          </p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1 rounded border border-[#0f2038]/40 bg-white px-2 py-1 text-xs hover:bg-[#eef2f6]">
            <Plus className="h-3 w-3" /> Record a bill
          </button>
          <button onClick={onBack} className="rounded border border-[#0f2038]/40 bg-white px-2 py-1 text-xs hover:bg-[#eef2f6]">Back</button>
        </div>
      </div>

      <div className="mb-2 flex gap-1 text-[11px]">
        {(['RECEIVABLE', 'PAYABLE'] as const).map((s) => (
          <button key={s} onClick={() => setSide(s)}
            className={`rounded px-2 py-0.5 ${side === s ? 'bg-[#1B2A4A] text-white' : 'bg-white/70 hover:bg-white'}`}>
            {s === 'RECEIVABLE' ? `Receivable ₹${inr(report.totals.receivable)}` : `Payable ₹${inr(report.totals.payable)}`}
          </button>
        ))}
      </div>

      {adding && <AddBill ledgers={ledgers} side={side} pending={pending} onDone={() => { setAdding(false); onRefresh(); }} start={start} />}

      {/* Ageing summary — where the money sits */}
      <div className="mb-3 grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(130px,1fr))]">
        {AGEING_BUCKETS.map((b) => {
          const v = buckets[b.key as BucketKey] ?? 0;
          const overdue = b.key !== 'notDue' && v > 0;
          return (
            <div key={b.key} className={`border p-2 ${overdue ? 'border-rose-400/60 bg-rose-50' : 'border-[#0f2038]/25 bg-white'}`}>
              <p className="text-[11px] text-[#5B4412]">{b.label}</p>
              <p className={`font-semibold ${overdue ? 'text-rose-700' : ''}`}>₹{inr(v)}</p>
            </div>
          );
        })}
      </div>

      {parties.length === 0 ? (
        <p className="border border-dashed border-[#0f2038]/30 p-6 text-center text-sm text-[#5B4412]">
          No open {side === 'RECEIVABLE' ? 'receivables' : 'payables'}. Record a bill above, or raise a Sales or Purchase
          voucher — bills are created from those automatically.
        </p>
      ) : (
        <div className="border border-[#0f2038]/30 bg-white">
          <table className="w-full min-w-[34rem] border-collapse text-[12px]">
            <thead className="bg-[#c9d4e0] text-left">
              <tr><th className="p-1.5">Party</th><th className="p-1.5 text-right">Outstanding</th><th className="p-1.5 text-right">Oldest</th><th className="p-1.5"></th></tr>
            </thead>
            <tbody>
              {parties.map((p) => <PartyRow key={p.ledgerId} party={p} />)}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#0f2038] bg-[#eef2f6] font-semibold">
                <td className="p-1.5">Total</td>
                <td className="p-1.5 text-right">₹{inr(total)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

function PartyRow({ party }: { party: PartyAgeing }) {
  const [open, setOpen] = React.useState(false);
  const [chasing, setChasing] = React.useState(false);
  const late = party.oldestOverdueDays;
  return (
    <>
      <tr className="border-t border-[#0f2038]/15">
        <td className="p-1.5 font-medium">{party.party}</td>
        <td className="p-1.5 text-right">₹{inr(party.total)}</td>
        <td className={`p-1.5 text-right ${late > 60 ? 'font-semibold text-rose-700' : late > 0 ? 'text-amber-700' : 'text-[#5B4412]'}`}>
          {late > 0 ? `${late} days late` : 'not yet due'}
        </td>
        <td className="p-1.5 text-right">
          <button onClick={() => setChasing(true)} title={`Set up automatic reminders for ${party.party}`} className="mr-1 rounded px-1.5 py-0.5 text-[11px] hover:bg-[#eef2f6]">
            Remind…
          </button>
          <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] hover:bg-[#eef2f6]" aria-expanded={open}>
            {party.bills.length} bill{party.bills.length === 1 ? '' : 's'}
            <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {chasing && <PartyReminderPanel ledgerId={party.ledgerId} party={party.party} onClose={() => setChasing(false)} />}
        </td>
      </tr>
      {open && party.bills.map((b) => (
        <tr key={b.id} className="border-t border-[#0f2038]/10 bg-[#f4f7fa] text-[11px]">
          <td className="py-1 pl-5 pr-1.5">
            {b.reference}
            {b.narration && <span className="text-[#5B4412]"> · {b.narration}</span>}
            <span className="block text-[#5B4412]">dated {b.billDate}{b.dueDate ? ` · due ${b.dueDate}` : ''}</span>
          </td>
          <td className="p-1 text-right">
            ₹{inr(b.outstanding)}
            {b.settled > 0 && <span className="block text-[#5B4412]">₹{inr(b.settled)} of ₹{inr(b.amount)} received</span>}
          </td>
          <td className="p-1 text-right">{b.daysOverdue > 0 ? `${b.daysOverdue}d` : '—'}</td>
          <td />
        </tr>
      ))}
    </>
  );
}

function AddBill({ ledgers, side, pending, onDone, start }: {
  ledgers: Array<{ id: string; name: string; group: string }>;
  side: 'RECEIVABLE' | 'PAYABLE';
  pending: boolean;
  onDone: () => void;
  start: React.TransitionStartFunction;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = React.useState({ ledgerId: '', reference: '', billDate: today, dueDate: '', amount: '', narration: '' });

  // Debtors owe us; creditors are owed by us.
  const want = side === 'RECEIVABLE' ? 'Sundry Debtors' : 'Sundry Creditors';
  const options = ledgers.filter((l) => l.group === want);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const r = await createTallyBill({ ...f, kind: side });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Bill recorded');
      onDone();
    });
  };

  return (
    <form onSubmit={submit} className="mb-3 grid gap-2 border border-[#0f2038]/30 bg-[#eef2f6] p-2 sm:grid-cols-2 lg:grid-cols-6">
      <select required value={f.ledgerId} onChange={(e) => setF({ ...f, ledgerId: e.target.value })} className="border border-[#0f2038]/40 bg-white px-1.5 py-1 text-xs lg:col-span-2" aria-label="Party">
        <option value="">{options.length ? `Choose a ${side === 'RECEIVABLE' ? 'debtor' : 'creditor'}…` : `No ${want} yet`}</option>
        {options.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
      <input required value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="Bill ref (AH/24-25/118)" className="border border-[#0f2038]/40 bg-white px-1.5 py-1 text-xs" />
      <input type="date" value={f.billDate} onChange={(e) => setF({ ...f, billDate: e.target.value })} className="border border-[#0f2038]/40 bg-white px-1.5 py-1 text-xs" aria-label="Bill date" />
      <input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} className="border border-[#0f2038]/40 bg-white px-1.5 py-1 text-xs" aria-label="Due date" title="Due date — ageing is measured from here" />
      <div className="flex gap-1">
        <input required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="Amount" inputMode="numeric" className="w-full border border-[#0f2038]/40 bg-white px-1.5 py-1 text-xs" />
        <button type="submit" disabled={pending} className="bg-[#1B2A4A] px-2 py-1 text-xs text-white disabled:opacity-50">Save</button>
      </div>
      <p className="text-[11px] text-[#5B4412] lg:col-span-6">
        Ageing runs from the due date. Leave it blank and the bill date is used instead.
      </p>
    </form>
  );
}
