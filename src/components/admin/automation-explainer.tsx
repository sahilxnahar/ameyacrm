'use client';

import { useState } from 'react';
import { ChevronDown, Lightbulb } from 'lucide-react';
import { AUTOMATION_TRIGGERS } from '@/config/automation-capabilities';

/**
 * What an automation is, in words rather than jargon.
 *
 * Open by default the first time, because the page is otherwise a list of
 * triggers and conditions that assumes you already know what those are.
 */
export function AutomationExplainer() {
  const [open, setOpen] = useState(true);

  return (
    <section className="mb-5 rounded-lg border border-border bg-card">
      <button
        type="button" onClick={() => setOpen((o) => !o)}
        className="focus-ring flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 font-semibold">
          <Lightbulb className="h-4 w-4 text-primary" />
          How automations work
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-5 border-t border-border px-4 py-4 text-sm">
          <div>
            <p className="text-muted-foreground">
              An automation is a standing instruction: <strong className="text-foreground">when this happens,
              check that, then do this</strong>. Nobody has to remember it and it does not
              take a holiday. That is the whole idea.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Step n="1" title="Trigger — when">
              The moment it wakes up. An enquiry arriving, a task changing status, or simply once a
              day. Everything else only happens after the trigger fires.
            </Step>
            <Step n="2" title="Conditions — but only if">
              Optional filters, like &ldquo;only when the budget is above one crore&rdquo;. No conditions means it
              runs every single time — which is often what you want, and occasionally very much not.
            </Step>
            <Step n="3" title="Actions — do this">
              What actually happens: assign somebody, create a task, notify a role, send an email from a
              template.
            </Step>
          </div>

          <div>
            <h4 className="font-medium">What can set one off</h4>
            <ul className="mt-2 space-y-1.5">
              {AUTOMATION_TRIGGERS.map((t) => (
                <li key={t.value} className="text-muted-foreground">
                  <strong className="text-foreground">{t.label}</strong> — {t.fires}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-medium">How to set one up</h4>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
              <li>Pick a template below — it is quicker than starting from nothing, and the wording is already sensible.</li>
              <li>Change the names, the wording and the timings to suit you.</li>
              <li>Switch it on. It starts working from the next time the trigger fires — it does not go back over old records.</li>
              <li>Come back in a day and look at the run history at the bottom of this page to see what it actually did.</li>
            </ol>
          </div>

          <div className="rounded-md bg-muted/50 p-3">
            <h4 className="font-medium">Two things worth knowing</h4>
            <ul className="mt-1.5 space-y-1 text-muted-foreground">
              <li>
                <strong className="text-foreground">Notify a role, not a person</strong> wherever you can.
                A rule pointed at a named person quietly stops working the day they leave.
              </li>
              <li>
                <strong className="text-foreground">Start with two or three.</strong> Twenty automations
                switched on at once produce a lot of notifications, and the usual response is to
                ignore all of them.
              </li>
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="flex items-center gap-2 font-medium">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">{n}</span>
        {title}
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">{children}</p>
    </div>
  );
}
