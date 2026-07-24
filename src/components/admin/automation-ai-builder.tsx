'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, Sparkles, X } from 'lucide-react';
import { draftAutomation, createAutomationRule } from '@/server/actions/automation';
import type { DraftAutomation } from '@/lib/automation/sanitise';
import { AUTOMATION_ACTIONS, AUTOMATION_TRIGGERS, AUTOMATION_OPERATORS } from '@/config/automation-capabilities';

const EXAMPLES = [
  'When an enquiry comes in with a budget over two crore, tell the managers straight away',
  'Every day, raise a task to chase demands that have been raised but not paid',
  'When a site task is marked blocked, notify the department head',
  'When an enquiry is marked lost, raise a task to write down why',
];

const label = {
  trigger: (v: string) => AUTOMATION_TRIGGERS.find((t) => t.value === v)?.label ?? v,
  action: (v: string) => AUTOMATION_ACTIONS.find((a) => a.type === v)?.label ?? v,
  op: (v: string) => AUTOMATION_OPERATORS.find((o) => o.op === v)?.label ?? v,
};

/**
 * Describe an automation and have it built for you.
 *
 * It always stops at a preview. The AI is good at turning a sentence into the
 * right shape, but it is being asked to create something that will assign work
 * and email people without anybody watching — so the last step is a person
 * reading it, every time.
 */
export function AutomationAiBuilder() {
  const router = useRouter();
  const [request, setRequest] = useState('');
  const [draft, setDraft] = useState<DraftAutomation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [thinking, startThinking] = useTransition();
  const [saving, startSaving] = useTransition();

  const build = () =>
    startThinking(async () => {
      setError(null); setDraft(null); setSaved(false);
      const res = await draftAutomation(request);
      if ('error' in res) setError(res.error);
      else setDraft(res.draft);
    });

  const save = () =>
    startSaving(async () => {
      if (!draft) return;
      const res = await createAutomationRule({
        name: draft.name,
        description: draft.description,
        trigger: draft.trigger,
        matchAll: draft.matchAll,
        conditions: draft.conditions,
        actions: draft.actions,
        // Never switched on by the AI. Somebody reads it, then turns it on.
        isActive: false,
      });
      if ('error' in res) setError(res.error);
      else { setSaved(true); setDraft(null); setRequest(''); router.refresh(); }
    });

  return (
    <section className="mb-5 rounded-lg border border-primary/30 bg-primary/[0.03] p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Sparkles className="h-4 w-4 text-primary" />
        Describe it, and I will build it
      </h2>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Say what you want to happen in your own words. It will be turned into a rule using the same
        building blocks as the templates below, then shown to you for approval — nothing is switched on
        until you say so.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && request.trim().length > 7) build(); }}
          placeholder="When an enquiry arrives from a portal, tell the sales manager…"
          className="focus-ring min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button
          type="button" onClick={build} disabled={thinking || request.trim().length < 8}
          className="focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {thinking ? 'Building…' : 'Build it'}
        </button>
      </div>

      {!draft && !thinking && (
        <div className="chip-row mt-2">
          {EXAMPLES.map((e) => (
            <button
              key={e} type="button" onClick={() => setRequest(e)}
              className="focus-ring shrink-0 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted"
            >{e}</button>
          ))}
        </div>
      )}

      {error && <p role="alert" className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {saved && (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
          Saved, switched off. Find it in the list below, check it reads right, then turn it on.
        </p>
      )}

      {draft && (
        <div className="mt-4 rounded-lg border border-border bg-card p-4">
          <h3 className="font-medium">{draft.name}</h3>
          {draft.description && <p className="mt-0.5 text-sm text-muted-foreground">{draft.description}</p>}

          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">When</dt>
              <dd>{label.trigger(draft.trigger)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Only if</dt>
              <dd>
                {draft.conditions.length
                  ? draft.conditions.map((c, i) => (
                      <span key={i} className="mr-1.5 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs">
                        {c.field} {label.op(c.op)}{c.value ? ` ${c.value}` : ''}
                      </span>
                    ))
                  : <span className="text-muted-foreground">No conditions — it runs every time.</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Then</dt>
              <dd>
                <ul className="list-disc space-y-0.5 pl-5">
                  {draft.actions.map((a, i) => (
                    <li key={i}>
                      {label.action(a.type)}
                      {Object.keys(a.params).length > 0 && (
                        <span className="text-muted-foreground">
                          {' — '}
                          {Object.entries(a.params).map(([k, v]) => `${k}: ${String(v)}`).join(', ')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>

          {draft.notes.length > 0 && (
            <div className="mt-3 rounded-md bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              <p className="font-medium">Worth reading before you switch it on</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {draft.notes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button" onClick={save} disabled={saving}
              className="focus-ring inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save it (switched off)
            </button>
            <button
              type="button" onClick={() => setDraft(null)}
              className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm"
            ><X className="h-4 w-4" />Discard</button>
          </div>
        </div>
      )}
    </section>
  );
}
