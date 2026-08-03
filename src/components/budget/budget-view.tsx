'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, Play, PencilLine } from 'lucide-react';
import { setUpCostCodes, explainVariance, saveBudget } from '@/server/actions/budgets';
import type { HeadResult } from '@/lib/budget/variance';
import type { rollUp } from '@/lib/budget/variance';
import { cn } from '@/lib/utils/cn';

const inr = (n: number) => n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export interface CostCodeOption { id: string; code: string; name: string; parentId: string | null }
export interface BudgetLineInput { costCode: string; amount: number; note: string | null }

export function BudgetView({
  canManage, projects, projectId, costCodeCount, heads, total, hasBudget, budgetName,
  costCodes = [], currentVersion = null, currentName = null, currentLines = [],
}: {
  canManage: boolean;
  projects: Array<{ id: string; name: string }>;
  projectId: string | null;
  costCodeCount: number;
  heads: HeadResult[];
  total: ReturnType<typeof rollUp> | null;
  hasBudget: boolean;
  budgetName: string | null;
  costCodes?: CostCodeOption[];
  currentVersion?: number | null;
  currentName?: string | null;
  currentLines?: BudgetLineInput[];
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ bad: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);

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
      <div className="toolbar items-center gap-2">
        {budgetName
          ? <p className="text-xs text-muted-foreground">Comparing against {budgetName}.</p>
          : <span />}
        {canManage && projectId && !editing && (
          <button
            type="button" onClick={() => setEditing(true)}
            className="focus-ring inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            <PencilLine className="h-4 w-4" />
            {currentVersion ? `Revise the budget (v${currentVersion})` : 'Set the budget'}
          </button>
        )}
      </div>

      {editing && projectId && (
        <BudgetEditor
          projectId={projectId}
          costCodes={costCodes}
          currentLines={currentLines}
          currentName={currentName}
          currentVersion={currentVersion}
          onCancel={() => setEditing(false)}
          onSaved={(text, bad) => { setMsg({ text, bad }); if (!bad) setEditing(false); router.refresh(); }}
        />
      )}

      {total && (
        <div className="stat-grid">
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

/**
 * Type the figures each head is allowed.
 *
 * Every head is listed, not just the ones already budgeted, because a budget you
 * have to remember to add rows to is a budget with holes in it. Leave a head at
 * zero and it is simply not budgeted; the comparison table will show whatever is
 * spent on it as unbudgeted, which is the honest answer.
 *
 * Saving never overwrites. `saveBudget` files a new version and marks the old one
 * superseded, so "what did we originally think this would cost" stays answerable —
 * that question is the only reason the next estimate gets better.
 */
function BudgetEditor({
  projectId, costCodes, currentLines, currentName, currentVersion, onCancel, onSaved,
}: {
  projectId: string;
  costCodes: CostCodeOption[];
  currentLines: BudgetLineInput[];
  currentName: string | null;
  currentVersion: number | null;
  onCancel: () => void;
  onSaved: (text: string, bad: boolean) => void;
}) {
  const seeded = new Map(currentLines.map((l) => [l.costCode, l]));
  const [name, setName] = useState(currentName ?? 'Approved budget');
  const [rows, setRows] = useState<Record<string, { amount: string; note: string }>>(() =>
    Object.fromEntries(costCodes.map((c) => [c.code, {
      amount: seeded.get(c.code)?.amount ? String(seeded.get(c.code)!.amount) : '',
      note: seeded.get(c.code)?.note ?? '',
    }])),
  );
  const [pending, start] = useTransition();

  const lines = costCodes
    .map((c) => ({ costCode: c.code, amount: Number(rows[c.code]?.amount ?? 0), note: rows[c.code]?.note?.trim() || null }))
    .filter((l) => Number.isFinite(l.amount) && l.amount > 0);
  const grand = lines.reduce((s, l) => s + l.amount, 0);

  if (!costCodes.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        There are no budgetable heads — every cost code is still a heading. Add heads underneath them first.
        <button type="button" onClick={onCancel} className="focus-ring ml-2 underline">Close</button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="toolbar items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="budgetname" className="text-xs font-medium text-muted-foreground">What to call this version</label>
          <input
            id="budgetname" value={name} onChange={(e) => setName(e.target.value)}
            className="focus-ring block w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm sm:w-64"
            placeholder="Approved budget"
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Saves as <strong className="text-foreground">version {(currentVersion ?? 0) + 1}</strong>
          {currentVersion ? ` — version ${currentVersion} is kept and marked superseded.` : '.'}
        </p>
      </div>

      <div className="max-h-[26rem] overflow-y-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Code</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Head</th>
              <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Budget (₹)</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Basis (optional)</th>
            </tr>
          </thead>
          <tbody>
            {costCodes.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-3 py-1 text-xs text-muted-foreground">{c.code}</td>
                <td className="px-3 py-1">{c.name}</td>
                <td className="px-3 py-1 text-right">
                  <input
                    type="number" min={0} inputMode="numeric"
                    value={rows[c.code]?.amount ?? ''}
                    onChange={(e) => setRows((p) => ({ ...p, [c.code]: { amount: e.target.value, note: p[c.code]?.note ?? '' } }))}
                    className="focus-ring w-36 rounded-md border border-input bg-background px-2 py-1 text-right text-sm tabular-nums"
                    placeholder="0"
                  />
                </td>
                <td className="px-3 py-1">
                  <input
                    value={rows[c.code]?.note ?? ''}
                    onChange={(e) => setRows((p) => ({ ...p, [c.code]: { amount: p[c.code]?.amount ?? '', note: e.target.value } }))}
                    className="focus-ring w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                    placeholder="400 t at ₹65,000"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="toolbar items-center gap-3">
        <p className="text-sm">
          {lines.length} head{lines.length === 1 ? '' : 's'} budgeted · total <strong className="tabular-nums">{inr(grand)}</strong>
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="focus-ring rounded-md border border-input px-3 py-1.5 text-sm">Cancel</button>
          <button
            type="button" disabled={pending || !lines.length || name.trim().length < 2}
            onClick={() => start(async () => {
              const r = await saveBudget({ projectId, name: name.trim(), lines });
              onSaved('error' in r ? r.error : r.message, 'error' in r);
            })}
            className="focus-ring inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save version {(currentVersion ?? 0) + 1}
          </button>
        </div>
      </div>
      {!lines.length && <p className="text-xs text-muted-foreground">Put a figure against at least one head before saving.</p>}
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
