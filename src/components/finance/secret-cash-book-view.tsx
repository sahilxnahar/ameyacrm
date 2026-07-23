'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, X, Trash2, LockKeyhole, Download, Users, ArrowDownLeft, ArrowUpRight, FileSpreadsheet } from 'lucide-react';
import { addSecretEntry, deleteSecretEntry, lockSecretCashBook, setSecretNominees } from '@/server/actions/secret-cashbook';
import { exportXlsx } from '@/lib/export/xlsx';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { StatTile } from '@/components/ui/stat-tile';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatCompactCurrency, formatDate } from '@/lib/utils/format';

interface Row { id: string; date: string; direction: string; amount: number; party: string; mode: string; reference: string | null; note: string | null; balance: number }
const inputCls = 'focus-ring w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm';

export function SecretCashBookView({
  rows, totalIn, totalOut, balance, isSuperAdmin, nominees, users,
}: {
  rows: Row[]; totalIn: number; totalOut: number; balance: number;
  isSuperAdmin: boolean; nominees: string[]; users: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [addOpen, setAddOpen] = React.useState(false);
  const [nomOpen, setNomOpen] = React.useState(false);

  const add = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await addSecretEntry({
        entryDate: String(fd.get('entryDate') ?? ''),
        direction: String(fd.get('direction') ?? 'OUT'),
        amount: String(fd.get('amount') ?? ''),
        party: String(fd.get('party') ?? ''),
        mode: String(fd.get('mode') ?? 'Cash'),
        reference: String(fd.get('reference') ?? ''),
        note: String(fd.get('note') ?? ''),
      });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Entry added'); setAddOpen(false); router.refresh();
    });
  };

  const remove = (row: Row) => start(async () => {
    const r = await deleteSecretEntry(row.id);
    if ('error' in r) { toast.error(r.error); return; }
    router.refresh();
    toast(`Deleted ${formatCurrency(row.amount)} · ${row.party}`);
  });

  const lockNow = () => start(async () => {
    await lockSecretCashBook();
    toast.success('Locked'); router.refresh();
  });

  const saveNominees = (ids: string[]) => start(async () => {
    const r = await setSecretNominees(ids);
    if ('error' in r) { toast.error(r.error); return; }
    toast.success('Access updated'); setNomOpen(false); router.refresh();
  });

  const exportCsv = () => {
    const lines = ['Date,Direction,Amount,Party,Mode,Reference,Note,Balance'];
    for (const r of [...rows].reverse()) {
      lines.push([formatDate(r.date), r.direction, r.amount, `"${r.party.replace(/"/g, '""')}"`, r.mode, r.reference ?? '', `"${(r.note ?? '').replace(/"/g, '""')}"`, r.balance].join(','));
    }
    const a = document.createElement('a');
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(lines.join('\n'))}`;
    a.download = 'secret-cash-book.csv';
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Cash in" value={formatCompactCurrency(totalIn)} tone="good" />
        <StatTile label="Cash out" value={formatCompactCurrency(totalOut)} tone="bad" />
        <StatTile label="Balance" value={formatCompactCurrency(balance)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button size="sm" onClick={() => setAddOpen((v) => !v)}>{addOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {addOpen ? 'Close' : 'Add entry'}</Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> CSV</Button>
          <Button size="sm" variant="outline" onClick={() => exportXlsx('secret-cash-book', 'Cash Book', [...rows].reverse().map((r) => ({ Date: formatDate(r.date), Direction: r.direction, Amount: r.amount, Party: r.party, Mode: r.mode, Reference: r.reference ?? '', Note: r.note ?? '', Balance: r.balance })))}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
          {isSuperAdmin && <Button size="sm" variant="outline" onClick={() => setNomOpen((v) => !v)}><Users className="h-4 w-4" /> Who can access</Button>}
          <Button size="sm" variant="ghost" onClick={lockNow}><LockKeyhole className="h-4 w-4" /> Lock now</Button>
        </div>
      </div>

      {isSuperAdmin && nomOpen && (
        <Card className="p-4">
          <p className="mb-2 text-sm font-semibold">Who can open the Secret Cash Book</p>
          <p className="mb-3 text-xs text-muted-foreground">You (the owner) always have access. Tick anyone else you want to nominate — they’ll still need their own one-time code each time.</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {users.map((u) => (
              <label key={u.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" defaultChecked={nominees.includes(u.id)} value={u.id} className="scb-nom" /> {u.name}
              </label>
            ))}
          </div>
          <Button size="sm" className="mt-3" disabled={pending}
            onClick={() => saveNominees(Array.from(document.querySelectorAll<HTMLInputElement>('.scb-nom:checked')).map((el) => el.value))}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />} Save access list
          </Button>
        </Card>
      )}

      {addOpen && (
        <Card className="p-4">
          <form onSubmit={add} className="grid gap-3 sm:grid-cols-2">
            <Field label="Direction">
              <select name="direction" defaultValue="OUT" className={inputCls}><option value="OUT">Cash out (paid)</option><option value="IN">Cash in (received)</option></select>
            </Field>
            <Field label="Amount (₹) *"><Input name="amount" type="number" step="1" required placeholder="10000" /></Field>
            <Field label="Party / for whom *"><Input name="party" required placeholder="e.g. Site cash to Ravi" /></Field>
            <Field label="Date"><Input name="entryDate" type="date" /></Field>
            <Field label="Mode">
              <select name="mode" defaultValue="Cash" className={inputCls}><option>Cash</option><option>Bank</option><option>UPI</option><option>Cheque</option></select>
            </Field>
            <Field label="Reference (UTR / voucher no.)"><Input name="reference" placeholder="optional" /></Field>
            <div className="sm:col-span-2"><Field label="Note"><Input name="note" placeholder="optional" /></Field></div>
            <div className="sm:col-span-2"><Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Save entry</Button></div>
          </form>
        </Card>
      )}

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground"><tr className="text-left"><th className="p-2">Date</th><th className="p-2">Party</th><th className="p-2">Mode</th><th className="p-2">Reference</th><th className="p-2 text-right">Amount</th><th className="p-2 text-right">Balance</th><th className="p-2" /></tr></thead>
            <tbody>
              {rows.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No entries yet.</td></tr> : rows.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="p-2 whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="p-2"><p className="font-medium">{r.party}</p>{r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}</td>
                  <td className="p-2">{r.mode}</td>
                  <td className="p-2 font-mono text-xs">{r.reference ?? '—'}</td>
                  <td className="p-2 text-right tabular-nums">
                    <span className={`inline-flex items-center gap-1 ${r.direction === 'IN' ? 'text-success' : 'text-destructive'}`}>
                      {r.direction === 'IN' ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}{formatCurrency(r.amount)}
                    </span>
                  </td>
                  <td className="p-2 text-right tabular-nums">{formatCurrency(r.balance)}</td>
                  <td className="p-2 text-right"><Button size="sm" variant="ghost" onClick={() => remove(r)} disabled={pending} title="Delete"><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Badge variant="secondary" className="text-[10px]">Private</Badge> These entries are stored separately and never appear in the normal books, reports or exports.</p>
    </div>
  );
}
