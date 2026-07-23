'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, X, Repeat, CheckCircle2, Pause, Play, Trash2 } from 'lucide-react';
import { createRecurring, setRecurringActive, deleteRecurring, recordRecurringNow } from '@/server/actions/recurring';
import { EXPENSE_CATEGORIES, CATEGORY_LABEL } from '@/config/expense-categories';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils/format';

interface Row {
  id: string; payeeName: string; amount: number; frequency: string; nextDue: string;
  category: string | null; mode: string | null; note: string | null; isActive: boolean; lastPaidAt: string | null;
}

const inputCls = 'focus-ring w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm';

export function RecurringView({ rows, canManage }: { rows: Row[]; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [addOpen, setAddOpen] = React.useState(rows.length === 0);

  const today = new Date(); today.setHours(23, 59, 59, 999);
  const isDue = (r: Row) => new Date(r.nextDue) <= today && r.isActive;

  const add = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await createRecurring({
        payeeName: String(fd.get('payeeName') ?? ''),
        amount: String(fd.get('amount') ?? ''),
        frequency: String(fd.get('frequency') ?? 'MONTHLY'),
        nextDue: String(fd.get('nextDue') ?? ''),
        category: String(fd.get('category') ?? ''),
        mode: String(fd.get('mode') ?? ''),
        note: String(fd.get('note') ?? ''),
      });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Recurring payment added'); setAddOpen(false); router.refresh();
    });
  };

  const record = (id: string) => start(async () => {
    const r = await recordRecurringNow(id);
    if ('error' in r) { toast.error(r.error); return; }
    toast.success('Recorded — next date rolled forward'); router.refresh();
  });
  const toggle = (id: string, active: boolean) => start(async () => {
    const r = await setRecurringActive(id, active);
    if ('error' in r) { toast.error(r.error); return; }
    router.refresh();
  });
  const remove = (id: string) => start(async () => {
    const r = await deleteRecurring(id);
    if ('error' in r) { toast.error(r.error); return; }
    toast.success('Deleted'); router.refresh();
  });

  const dueCount = rows.filter(isDue).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {rows.filter((r) => r.isActive).length} active
          {dueCount > 0 && <span className="ml-2 font-medium text-amber-600">· {dueCount} due now</span>}
        </p>
        {canManage && <Button size="sm" onClick={() => setAddOpen((v) => !v)}>{addOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} {addOpen ? 'Close' : 'New recurring payment'}</Button>}
      </div>

      {addOpen && canManage && (
        <Card className="p-4">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Repeat className="h-4 w-4 text-[#A07D34]" /> Add a recurring payment</p>
          <form onSubmit={add} className="grid gap-3 sm:grid-cols-2">
            <Field label="Paid to *"><Input name="payeeName" required placeholder="e.g. Office rent" /></Field>
            <Field label="Amount (₹) *"><Input name="amount" type="number" step="1" required placeholder="50000" /></Field>
            <Field label="How often">
              <select name="frequency" defaultValue="MONTHLY" className={inputCls}>
                <option value="WEEKLY">Weekly</option><option value="MONTHLY">Monthly</option><option value="QUARTERLY">Quarterly</option><option value="YEARLY">Yearly</option>
              </select>
            </Field>
            <Field label="Next due *"><Input name="nextDue" type="date" required /></Field>
            <Field label="Category">
              <select name="category" defaultValue="" className={inputCls}>
                <option value="">— none —</option>
                {EXPENSE_CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Mode">
              <select name="mode" defaultValue="Bank" className={inputCls}><option>Bank</option><option>UPI</option><option>Cash</option><option>Cheque</option></select>
            </Field>
            <div className="sm:col-span-2"><Field label="Note"><Input name="note" placeholder="e.g. Shop no. 4 rent" /></Field></div>
            <div className="sm:col-span-2"><Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Add</Button></div>
          </form>
        </Card>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground"><tr className="text-left"><th className="p-2">Paid to</th><th className="p-2 text-right">Amount</th><th className="p-2">Every</th><th className="p-2">Next due</th><th className="p-2">Category</th><th className="p-2 text-right" /></tr></thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No recurring payments yet.</td></tr> : rows.map((r) => (
              <tr key={r.id} className={`border-t ${!r.isActive ? 'opacity-50' : isDue(r) ? 'bg-amber-500/5' : ''}`}>
                <td className="p-2"><p className="font-medium">{r.payeeName}</p>{r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}</td>
                <td className="p-2 text-right tabular-nums">{formatCurrency(r.amount)}</td>
                <td className="p-2 capitalize">{r.frequency.toLowerCase()}</td>
                <td className="p-2 whitespace-nowrap">{new Date(r.nextDue).toLocaleDateString('en-IN')} {isDue(r) && <Badge variant="warning" className="ml-1 text-[10px]">Due</Badge>}</td>
                <td className="p-2 text-xs text-muted-foreground">{r.category ? CATEGORY_LABEL[r.category] ?? r.category : '—'}</td>
                <td className="p-2">
                  {canManage && (
                    <div className="flex items-center justify-end gap-1">
                      {r.isActive && <Button size="sm" variant="outline" onClick={() => record(r.id)} disabled={pending}><CheckCircle2 className="h-4 w-4" /> Record paid</Button>}
                      <Button size="sm" variant="ghost" onClick={() => toggle(r.id, !r.isActive)} disabled={pending} title={r.isActive ? 'Pause' : 'Resume'}>{r.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(r.id)} disabled={pending} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
