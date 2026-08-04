'use client';

import * as React from 'react';
import { ShieldCheck, Plus, Pencil, Trash2, ChevronDown } from 'lucide-react';
import type { AuditRow, VoucherSnapshot } from '@/server/services/tally-audit-service';

/**
 * The edit log, as an auditor reads it.
 *
 * Shown in the Tally shell's own style. Every entry expands to the exact
 * before/after state of the voucher, because "amount changed" is not an answer
 * to "changed from what, to what".
 */
const inr = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function EditLogView({ rows, onBack }: { rows: AuditRow[] | null; onBack: () => void }) {
  const [open, setOpen] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<'ALL' | 'CREATE' | 'UPDATE' | 'DELETE'>('ALL');

  const shown = (rows ?? []).filter((r) => filter === 'ALL' || r.action === filter);
  const count = (a: string) => (rows ?? []).filter((r) => r.action === a).length;

  const icon = (a: string) =>
    a === 'CREATE' ? <Plus className="h-3.5 w-3.5 text-emerald-600" />
    : a === 'DELETE' ? <Trash2 className="h-3.5 w-3.5 text-rose-600" />
    : <Pencil className="h-3.5 w-3.5 text-amber-600" />;

  return (
    <div>
      <div className="mb-3 toolbar items-center gap-2">
        <div>
          <h2 className="font-semibold">Edit log — every change to the books</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#5B4412]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Kept automatically and cannot be switched off, as the Companies (Accounts) Rules require. Nothing here can be edited or removed.
          </p>
        </div>
        <button onClick={onBack} className="rounded border border-[#0f2038]/40 bg-white px-2 py-1 text-xs hover:bg-[#eef2f6]">Back</button>
      </div>

      <div className="mb-2 flex flex-wrap gap-1 text-[11px]">
        {(['ALL', 'CREATE', 'UPDATE', 'DELETE'] as const).map((f) => (
          <button
            key={f} onClick={() => setFilter(f)}
            className={`rounded px-2 py-0.5 ${filter === f ? 'bg-[#1B2A4A] text-white' : 'bg-white/70 hover:bg-white'}`}
          >
            {f === 'ALL' ? `All (${rows?.length ?? 0})` : `${f[0]}${f.slice(1).toLowerCase()}d (${count(f)})`}
          </button>
        ))}
      </div>

      {rows === null ? (
        <p className="p-6 text-center text-sm text-[#5B4412]">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="rounded border border-dashed border-[#0f2038]/30 p-6 text-center text-sm text-[#5B4412]">
          No changes recorded yet. Entries appear here the moment a voucher is created, edited or deleted.
        </p>
      ) : (
        <div className="overflow-x-auto border border-[#0f2038]/30 bg-white">
          <table className="w-full text-[12px]">
            <thead className="bg-[#c9d4e0] text-left">
              <tr>
                <th className="p-1.5">When</th><th className="p-1.5">Who</th>
                <th className="p-1.5">Voucher</th><th className="p-1.5">What changed</th><th className="p-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <React.Fragment key={r.id}>
                  <tr className="border-t border-[#0f2038]/15 align-top">
                    <td className="whitespace-nowrap p-1.5 text-[#5B4412]">
                      {new Date(r.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-1.5">{r.actorName}</td>
                    <td className="whitespace-nowrap p-1.5">
                      <span className="inline-flex items-center gap-1">{icon(r.action)} {r.voucherType} #{r.voucherNo}</span>
                    </td>
                    <td className="p-1.5">{r.summary}</td>
                    <td className="p-1.5 text-right">
                      <button
                        onClick={() => setOpen(open === r.id ? null : r.id)}
                        className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] hover:bg-[#eef2f6]"
                        aria-expanded={open === r.id}
                      >
                        Detail <ChevronDown className={`h-3 w-3 transition-transform ${open === r.id ? 'rotate-180' : ''}`} />
                      </button>
                    </td>
                  </tr>
                  {open === r.id && (
                    <tr className="border-t border-[#0f2038]/10 bg-[#f4f7fa]">
                      <td colSpan={5} className="p-2">
                        <div className="grid gap-3 md:grid-cols-2">
                          <Snapshot title="Before" snap={r.before} />
                          <Snapshot title="After" snap={r.after} />
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Snapshot({ title, snap }: { title: string; snap: VoucherSnapshot | null }) {
  if (!snap) {
    return (
      <div className="border border-[#0f2038]/20 bg-white p-2">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#5B4412]">{title}</p>
        <p className="text-[12px] text-[#5B4412]">{title === 'Before' ? 'Did not exist — this created it.' : 'Deleted — nothing remains.'}</p>
      </div>
    );
  }
  const dr = snap.lines.reduce((s, l) => s + l.debit, 0);
  return (
    <div className="border border-[#0f2038]/20 bg-white p-2">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#5B4412]">{title}</p>
      <p className="text-[12px]">{snap.type} #{snap.number} · {snap.date}</p>
      {snap.narration && <p className="text-[11px] text-[#5B4412]">{snap.narration}</p>}
      {snap.costCentre && <p className="text-[11px] text-[#5B4412]">Cost centre: {snap.costCentre}</p>}
      <div className="table-scroll"><table className="mt-1.5 w-full text-[11px]">
        <thead><tr className="text-left text-[#5B4412]"><th>Ledger</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead>
        <tbody>
          {snap.lines.map((l, i) => (
            <tr key={i} className="border-t border-[#0f2038]/10">
              <td className="py-0.5">{l.ledger}</td>
              <td className="py-0.5 text-right">{l.debit ? inr(l.debit) : '—'}</td>
              <td className="py-0.5 text-right">{l.credit ? inr(l.credit) : '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr className="border-t border-[#0f2038]/30 font-semibold"><td>Total</td><td className="text-right">{inr(dr)}</td><td className="text-right">{inr(dr)}</td></tr></tfoot>
      </table></div>
      {snap.inventory && snap.inventory.length > 0 && (
        <p className="mt-1 text-[11px] text-[#5B4412]">
          Stock: {snap.inventory.map((i) => `${i.item} ${i.direction} ${i.qty}`).join(' · ')}
        </p>
      )}
    </div>
  );
}
