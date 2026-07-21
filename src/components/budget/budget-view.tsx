'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, Play } from 'lucide-react';
import { setUpCostCodes, explainVariance } from '@/server/actions/budgets';
import type { HeadResult } from '@/lib/budget/variance';
import type { rollUp } from '@/lib/budget/variance';
import { cn } from '@/lib/utils/cn';

const inr = (n: number) => n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export function BudgetView({
  canManage, projects, projectId, costCodeCount, heads, total, hasBudget, budgetName,
}: {
  canManage: boolean;
  projects: Array<{ id: string; name: string }>;
  projectId: string | null;
  costCodeCount: number;
  heads: HeadResult[];
  total: ReturnType<typeof rollUp> | null;
  hasBudget: boolean;
  budgetName: string | null;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ bad: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  if (costCodeCount === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <h2 className="font-display text-xl font-semibold">No cost breakdown yet</h2>
        <p className="mx-auto mt-2 max-w-prose text-sm text-muted-foreground">
          Setting up creates the standard heads for a residential development — land, approvals,
          structure, finishes, services, externals, preliminaries and overheads. Deliberately shallow:
          somebody has to pick the right one on every bill, and a twelve-level breakdown gets abandoned
          within a quarter.
        </p>
        {canManage ? (
          <button
            type="button" disabled={pending}
            onClick={() => start(async () => {
              const r = await setUpCostCodes();
              setMsg('error' in r ? { bad: true, text: r.error } : { bad: false, text: r.message });
              router.refresh();
            })}
            className="focus-ring mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Set up cost codes
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
      {projects.length > 1 && (
        <div className="chip-row">
          {projects.map((p) => (
            <a
              key={p.id} href={`/budgets?project=${p.id}`}
              className={cn(
                'focus-ring shrink-0 rounded-full border px-3 py-1 text-xs font-medium',
                p.id === projectId ? 'border-primary bg-primary/10 text-primary' : 'border-border',
              )}
            >{p.name}</a>
          ))}
        </div>
      )}

      {!hasBudget && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            No budget has been approved for this project, so there is nothing to compare against.
            Everything spent so far is shown below as unbudgeted.
          </span>
        </div>
      )}
      {budgetName && <p className="text-xs text-muted-foreground">Comparing against {budgetName}.</p>}

      {total && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Budget" value={inr(total.budget)} />
          <Stat label="Committed and incurred" value={inr(total.exposure)} hint={`${total.usedPct}% of budget`} />
          <Stat label="Paid" value={inr(total.paid)} hint="Money actually gone" />
          <Stat
            label="Remaining"
            value={inr(total.remaining)}
            tone={total.remaining < 0 ? 'bad' : 'good'}
            hint={total.overCount ? `${total.overCount} head(s) over` : 'No head over budget'}
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {['Code', 'Head', 'Budget', 'Committed + incurred', 'Paid', 'Remaining', ''].map((h, i) => (
                <th key={h} className={cn('px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground', i >= 2 && i <= 5 && 'text-right')}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heads.map((h) => (
              <tr key={h.costCode} className={cn('border-t border-border', h.overBudget && 'bg-destructive/5')}>
                <td className="px-3 py-1.5 text-xs text-muted-foreground">{h.costCode}</td>
                <td className="px-3 py-1.5">{h.name}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{inr(h.budget)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{inr(h.exposure)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">{inr(h.paid)}</td>
                <td className={cn('px-3 py-1.5 text-right tabular-nums', h.remaining < 0 && 'font-medium text-destructive')}>{inr(h.remaining)}</td>
                <td className="px-3 py-1.5">
                  {h.needsExplanation && canManage && projectId && (
                    <ExplainButton
                      projectId={projectId} head={h}
                      onDone={(text, bad) => { setMsg({ text, bad }); router.refresh(); }}
                    />
                  )}
                </td>
              </tr>
            ))}
            {!heads.length && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing budgeted or spent yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {msg && <p className={cn('text-sm', msg.bad ? 'text-destructive' : 'text-emerald-600')}>{msg.text}</p>}
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('font-display text-xl font-semibold tabular-nums', tone === 'bad' && 'text-destructive', tone === 'good' && 'text-emerald-600')}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ExplainButton({ projectId, head, onDone }: {
  projectId: string; head: HeadResult; onDone: (m: string, bad: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [action, setAction] = useState('');
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="focus-ring whitespace-nowrap rounded-md border border-amber-500/50 px-2 py-1 text-xs text-amber-700 dark:text-amber-500">
        Explain
      </button>
    );
  }
  return (
    <div className="min-w-[16rem] space-y-1.5">
      <p className="text-xs text-muted-foreground">
        {head.name} is {head.variance > 0 ? 'over' : 'under'} by {inr(Math.abs(head.variance))} ({Math.abs(head.variancePct)}%).
      </p>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why did it move?"
        className="focus-ring w-full rounded-md border border-input bg-background px-2 py-1 text-xs" />
      <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="What is being done about it? (optional)"
        className="focus-ring w-full rounded-md border border-input bg-background px-2 py-1 text-xs" />
      <div className="flex gap-1.5">
        <button type="button" disabled={pending || reason.trim().length < 10}
          className="focus-ring rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-60"
          onClick={() => start(async () => {
            const r = await explainVariance({
              projectId, costCode: head.costCode,
              varianceAmount: head.variance, variancePct: head.variancePct,
              reason, action,
            });
            onDone('error' in r ? r.error : r.message, 'error' in r);
            setOpen(false);
          })}
        >{pending ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={() => setOpen(false)} className="focus-ring rounded-md border border-input px-2 py-1 text-xs">Cancel</button>
      </div>
    </div>
  );
}
