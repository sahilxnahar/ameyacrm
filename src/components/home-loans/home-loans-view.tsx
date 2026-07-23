'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Loader2, Trash2, Landmark, BadgeCheck, FileSignature } from 'lucide-react';
import { createHomeLoan, updateHomeLoan, deleteHomeLoan } from '@/server/actions/home-loans';
import type { HomeLoanRow, HomeLoanSummary } from '@/server/services/home-loan-service';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

const STATUSES = ['ENQUIRY', 'APPLIED', 'SANCTIONED', 'DISBURSED_PARTIAL', 'DISBURSED_FULL', 'REJECTED'] as const;
const STATUS_LABEL: Record<string, string> = {
  ENQUIRY: 'Enquiry', APPLIED: 'Applied', SANCTIONED: 'Sanctioned',
  DISBURSED_PARTIAL: 'Part-disbursed', DISBURSED_FULL: 'Fully disbursed', REJECTED: 'Rejected',
};
const STATUS_CLS: Record<string, string> = {
  ENQUIRY: 'bg-secondary text-secondary-foreground',
  APPLIED: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  SANCTIONED: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  DISBURSED_PARTIAL: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  DISBURSED_FULL: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  REJECTED: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
};

export function HomeLoansView({ loans, summary, canManage }: { loans: HomeLoanRow[]; summary: HomeLoanSummary; canManage: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [showAdd, setShowAdd] = React.useState(false);

  const run = (fn: () => Promise<{ ok: true; id?: string } | { error: string }>, ok?: string) =>
    start(async () => { const r = await fn(); if ('error' in r) { toast.error(r.error); return; } if (ok) toast.success(ok); router.refresh(); });

  const submitAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await createHomeLoan(Object.fromEntries(fd));
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Loan added'); setShowAdd(false); (e.target as HTMLFormElement).reset(); router.refresh();
    });
  };

  const tiles = [
    { label: 'Loans tracked', value: String(summary.count) },
    { label: 'Sanctioned', value: formatCurrency(summary.sanctionedTotal) },
    { label: 'Disbursed', value: formatCurrency(summary.disbursedTotal) },
    { label: 'NOC pending', value: String(summary.pendingNoc), bad: summary.pendingNoc > 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-3">
            <p className="text-xs text-muted-foreground">{t.label}</p>
            <p className={cn('mt-1 text-lg font-semibold tabular-nums', t.bad && 'text-rose-600')}>{t.value}</p>
          </Card>
        ))}
      </div>

      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" variant={showAdd ? 'ghost' : 'default'} onClick={() => setShowAdd((v) => !v)}>
            <Plus className="h-4 w-4" /> {showAdd ? 'Close' : 'Add a loan'}
          </Button>
        </div>
      )}

      {showAdd && canManage && (
        <Card className="p-4">
          <form onSubmit={submitAdd} className="grid gap-3 sm:grid-cols-2">
            <Input name="buyerName" placeholder="Buyer name *" required />
            <Input name="bankName" placeholder="Bank / lender *" required />
            <Input name="loanAmount" type="number" step="1" placeholder="Loan amount (₹)" />
            <Input name="applicationRef" placeholder="Application / reference no." />
            <select name="status" defaultValue="ENQUIRY" className="focus-ring h-9 rounded-md border border-input bg-background px-3 text-sm">
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <Input name="notes" placeholder="Notes (optional)" className="sm:col-span-2" />
            <div className="sm:col-span-2"><Button type="submit" size="sm" disabled={pending}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Save loan</Button></div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr className="text-left">
                <th className="p-2">Buyer</th><th className="p-2">Bank</th>
                <th className="p-2 text-right">Loan</th><th className="p-2 text-right">Sanctioned</th><th className="p-2 text-right">Disbursed</th>
                <th className="p-2">Status</th><th className="p-2">NOC</th><th className="p-2">Tripartite</th>{canManage && <th className="p-2" />}
              </tr>
            </thead>
            <tbody>
              {loans.length === 0 ? (
                <tr><td colSpan={canManage ? 9 : 8} className="p-6 text-center text-muted-foreground">No home loans tracked yet.</td></tr>
              ) : loans.map((l) => (
                <tr key={l.id} className="border-t align-middle">
                  <td className="p-2 font-medium">{l.buyerName}{l.applicationRef && <span className="block text-[11px] font-normal text-muted-foreground">Ref {l.applicationRef}</span>}</td>
                  <td className="p-2"><span className="inline-flex items-center gap-1"><Landmark className="h-3.5 w-3.5 text-muted-foreground" /> {l.bankName}</span></td>
                  <td className="p-2 text-right tabular-nums">{formatCurrency(l.loanAmount)}</td>
                  <td className="p-2 text-right tabular-nums">{l.sanctionedAmount == null ? '—' : formatCurrency(l.sanctionedAmount)}</td>
                  <td className="p-2 text-right tabular-nums">{formatCurrency(l.disbursedAmount)}</td>
                  <td className="p-2">
                    {canManage ? (
                      <select value={l.status} onChange={(e) => run(() => updateHomeLoan({ id: l.id, status: e.target.value }), 'Status updated')} disabled={pending} className={cn('focus-ring rounded-full border-0 px-2 py-0.5 text-[11px] font-medium', STATUS_CLS[l.status])}>
                        {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    ) : <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_CLS[l.status])}>{STATUS_LABEL[l.status]}</span>}
                  </td>
                  <td className="p-2">
                    <button disabled={!canManage || pending} onClick={() => run(() => updateHomeLoan({ id: l.id, nocIssued: !l.nocIssued }), l.nocIssued ? 'NOC cleared' : 'NOC issued')}
                      className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', l.nocIssued ? 'border-emerald-500/40 text-emerald-700' : 'text-muted-foreground', canManage && 'hover:bg-secondary')}>
                      <BadgeCheck className="h-3 w-3" /> {l.nocIssued ? 'Issued' : 'Pending'}
                    </button>
                  </td>
                  <td className="p-2">
                    <button disabled={!canManage || pending} onClick={() => run(() => updateHomeLoan({ id: l.id, tripartiteSigned: !l.tripartiteSigned }), l.tripartiteSigned ? 'Tripartite cleared' : 'Tripartite signed')}
                      className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', l.tripartiteSigned ? 'border-emerald-500/40 text-emerald-700' : 'text-muted-foreground', canManage && 'hover:bg-secondary')}>
                      <FileSignature className="h-3 w-3" /> {l.tripartiteSigned ? 'Signed' : 'Pending'}
                    </button>
                  </td>
                  {canManage && (
                    <td className="p-2 text-right">
                      <button onClick={() => run(() => deleteHomeLoan(l.id), 'Loan removed')} disabled={pending} className="inline-flex items-center gap-1 rounded-full border border-destructive/30 px-2 py-0.5 text-[11px] font-medium text-destructive hover:bg-secondary disabled:opacity-50"><Trash2 className="h-3 w-3" /> Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
