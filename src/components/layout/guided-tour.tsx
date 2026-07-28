'use client';

import * as React from 'react';
import Link from 'next/link';
import { HelpCircle, X, ArrowLeft, ArrowRight, Check } from 'lucide-react';

/**
 * An on-demand guided tour of the whole CRM. Available to everyone, at any
 * time, from the top bar — regardless of how long they have used the app. It is
 * pure client UI: no server call, no state saved, so it can be opened as often
 * as someone likes. Each step names an area in plain language and offers a
 * "Take me there" link.
 */
interface Step { title: string; body: string; href?: string; hrefLabel?: string }

const STEPS: Step[] = [
  {
    title: 'Welcome — how to get around',
    body: 'The menu on the left groups everything into plain-language sections. On a phone, tap the menu button top-left. Anywhere, press ⌘K (Ctrl-K) to search and jump straight to any screen or record.',
  },
  {
    title: 'Today — your daily priorities',
    body: 'Start here each morning. It gathers everything on your plate — follow-ups, tasks, approvals, payments to collect and meetings — ranked by what is overdue or due today.',
    href: '/today', hrefLabel: 'Open Today',
  },
  {
    title: 'Sales & Leads',
    body: 'Capture enquiries, log site visits, schedule follow-ups and move a lead through to a booking. Leads going cold are flagged so nothing slips.',
    href: '/sales', hrefLabel: 'Open Sales',
  },
  {
    title: 'Money — billing, payments & accounts',
    body: 'Raise invoices with GST, record payments by UTR, track collections, and use the built-in Tally-style accounting (Day Book, Trial Balance, P&L).',
    href: '/billing', hrefLabel: 'Open Billing',
  },
  {
    title: 'Build & Site',
    body: 'Run the construction programme, quality and safety checks, material requests and site updates — the on-the-ground side of each project.',
    href: '/field', hrefLabel: 'Open Site',
  },
  {
    title: 'Documents & the AI assistant',
    body: 'Upload any file — it is read and made searchable. Ask Documents answers questions from your files, and the Assistant helps you draft messages and explain screens. Find both in the top bar.',
    href: '/documents', hrefLabel: 'Open Documents',
  },
  {
    title: 'Insights & the daily briefing',
    body: 'Dashboards show how the business is doing, and the Daily Briefing summarises what changed, what is at risk, and what to do about it today.',
    href: '/briefing', hrefLabel: 'Open Briefing',
  },
  {
    title: 'Help whenever you need it',
    body: 'A Glossary explains any term, the Explore Features page lists everything the CRM can do, and this tour is always here in the top bar — click it any time.',
    href: '/glossary', hrefLabel: 'Open Glossary',
  },
];

export function GuidedTour() {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(0);

  const start = () => { setStep(0); setOpen(true); };
  const close = () => setOpen(false);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <>
      <button
        type="button"
        onClick={start}
        title="Take a tour — a quick guided walkthrough of the CRM"
        aria-label="Take a guided tour of the CRM"
        className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <HelpCircle className="h-4 w-4 shrink-0" />
        <span className="hidden text-xs font-medium xl:inline">Take a tour</span>
      </button>

      {open && current && (
        <div className="fixed inset-0 z-coach flex items-end justify-center bg-black/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Guided tour">
          <div className="card-elevated w-full max-w-md rounded-lg bg-background p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Guided tour · {step + 1} of {STEPS.length}</p>
                <h2 className="mt-1 font-display text-lg">{current.title}</h2>
              </div>
              <button type="button" onClick={close} aria-label="Close tour" className="focus-ring rounded p-1 text-muted-foreground hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-sm text-muted-foreground">{current.body}</p>

            {current.href && (
              <Link href={current.href} onClick={close} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary underline">
                {current.hrefLabel ?? 'Take me there'} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}

            <div className="mt-5 flex items-center justify-center gap-1.5">
              {STEPS.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30'}`} />
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
                className="focus-ring inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              {isLast ? (
                <button type="button" onClick={close} className="focus-ring inline-flex items-center gap-1 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground">
                  <Check className="h-4 w-4" /> Done
                </button>
              ) : (
                <button type="button" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} className="focus-ring inline-flex items-center gap-1 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground">
                  Next <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
