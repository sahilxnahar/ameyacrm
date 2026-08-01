'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HelpCircle, X, ArrowLeft, ArrowRight, Check } from 'lucide-react';

/**
 * An on-demand guided tour of the whole CRM, anchored to the real interface.
 *
 * The previous version was a centred modal over a full-page dim: it covered the
 * screen, pointed at nothing, and the thing being described sat hidden behind
 * the very box describing it. This version spotlights the actual control for
 * each step — the card travels to whichever button is being explained, so the
 * eye follows one moving object instead of re-reading a static panel.
 *
 * How the spotlight works: a single transparent element is positioned over the
 * target and given an enormous `box-shadow` spread. The shadow dims everything
 * outside it while the element's own area stays clear — one compositor-friendly
 * layer, rather than four dimming panels that must be kept in sync.
 *
 * Smoothness: measuring happens inside `requestAnimationFrame`, and the card
 * moves via `transform` (compositor-only) rather than `top`/`left`, which force
 * a layout pass on every frame. That is where the previous lag came from.
 *
 * Robustness: a step whose target is not on the page — hidden by permission, or
 * on a different route — is not skipped or left pointing at nothing. It falls
 * back to a centred card with no spotlight and still reads correctly.
 */

interface Step {
  title: string;
  body: string;
  /** Element to spotlight. First match wins; a missing target ⇒ centred card. */
  target?: string;
  href?: string;
  hrefLabel?: string;
}

const STEPS: Step[] = [
  {
    title: 'Welcome — how to get around',
    body: 'Everything is grouped into plain-language sections. This tour walks along the menu and points at each one in turn. Press ⌘K (Ctrl-K) any time to search and jump straight to a screen or record.',
    target: '[data-tour="brand"]',
  },
  {
    title: 'Search anything',
    body: 'One box for the whole CRM — a buyer’s name, a flat number, an invoice, a document. Start typing and it finds it.',
    target: '[data-tour="search"]',
  },
  {
    title: 'Sales & Leads',
    body: 'Capture enquiries, log site visits, schedule follow-ups and move a lead through to a booking. Leads going cold are flagged so nothing slips.',
    target: '[data-tour="nav-/sales"]',
    href: '/sales', hrefLabel: 'Open Sales',
  },
  {
    title: 'Inventory — your flats',
    body: 'Every unit across every tower: available, held, booked or registered. Hold a flat for a buyer and it releases itself if the hold lapses.',
    target: '[data-tour="nav-/inventory"]',
    href: '/inventory', hrefLabel: 'Open Inventory',
  },
  {
    title: 'Finance — billing & collections',
    body: 'Raise invoices with GST, record payments against a UTR, and chase what is due. Demand letters go out on their own for overdue instalments.',
    target: '[data-tour="nav-/finance"]',
    href: '/finance', hrefLabel: 'Open Finance',
  },
  {
    title: 'Site Ops',
    body: 'The on-the-ground side: construction progress, quality and safety checks, material requests and daily site updates.',
    target: '[data-tour="nav-/site-ops"]',
    href: '/site-ops', hrefLabel: 'Open Site Ops',
  },
  {
    title: 'Ameya Tally — your books',
    body: 'Full double-entry accounting: Day Book, Trial Balance, P&L and Balance Sheet. Import straight from Tally, or keep it in step automatically.',
    target: '[data-tour="nav-/tally"]',
    href: '/tally', hrefLabel: 'Open Ameya Tally',
  },
  {
    title: 'Messages & the Assistant',
    body: 'Talk to your team inside the CRM, and ask the Assistant to draft a message, explain a screen, or answer a question from your own documents.',
    target: '[data-tour="nav-/chat"]',
    href: '/chat', hrefLabel: 'Open Messages',
  },
  {
    title: 'Upload anything',
    body: 'Drop in a PDF, photo or spreadsheet. It is read, indexed and made searchable — then you can ask questions about what is inside it.',
    target: '[data-tour="nav-/documents"]',
    href: '/documents', hrefLabel: 'Open Documents',
  },
  {
    title: 'Pin what you use most',
    body: 'This menu is yours to arrange. Pin a ledger, a project or any screen you open daily and it stays here. Reorder or remove pins whenever you like.',
    target: '[data-tour="nav-customise"]',
  },
  {
    title: 'Alerts',
    body: 'Approvals waiting on you, payments received, a lead going cold — anything needing your attention appears here.',
    target: '[data-tour="alerts"]',
  },
  {
    title: 'That’s the tour',
    body: 'The Glossary explains any term you do not recognise, and Explore Features lists everything the CRM can do. This tour lives here in the top bar — start it again whenever you like.',
    target: '[data-tour="tour-button"]',
    href: '/features', hrefLabel: 'Explore all features',
  },
];

interface Placement { x: number; y: number; below: boolean }
interface Rect { top: number; left: number; width: number; height: number }

const CARD_W = 340;
const CARD_H_EST = 210;
const GAP = 14;
const PAD = 8;

export function GuidedTour() {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [rect, setRect] = React.useState<Rect | null>(null);
  const [place, setPlace] = React.useState<Placement | null>(null);
  const cardRef = React.useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  /**
   * Measure the current target and decide where the card sits. Called inside
   * rAF so a scroll or resize storm collapses to one measurement per frame.
   */
  const measure = React.useCallback(() => {
    const sel = STEPS[step]?.target;
    const el = sel ? document.querySelector<HTMLElement>(sel) : null;

    if (!el) {
      // Target absent (hidden by permission, or on another page) — centre the
      // card and drop the spotlight rather than ringing empty space.
      setRect(null);
      setPlace({
        x: Math.max(PAD, (window.innerWidth - CARD_W) / 2),
        y: Math.max(PAD, (window.innerHeight - CARD_H_EST) / 2),
        below: true,
      });
      return;
    }

    const r = el.getBoundingClientRect();
    const spot: Rect = { top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 };
    setRect(spot);

    const cardH = cardRef.current?.offsetHeight ?? CARD_H_EST;
    const belowY = spot.top + spot.height + GAP;
    const fitsBelow = belowY + cardH <= window.innerHeight - PAD;
    const y = fitsBelow ? belowY : Math.max(PAD, spot.top - GAP - cardH);
    const rawX = spot.left + spot.width / 2 - CARD_W / 2;
    const x = Math.min(Math.max(PAD, rawX), Math.max(PAD, window.innerWidth - CARD_W - PAD));
    setPlace({ x, y, below: fitsBelow });
  }, [step]);

  // Bring the target into view, then measure. Re-runs whenever the step changes.
  React.useEffect(() => {
    if (!open) return;
    const sel = STEPS[step]?.target;
    const el = sel ? document.querySelector<HTMLElement>(sel) : null;
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    let raf = requestAnimationFrame(measure);
    // Re-measure once the smooth scroll has settled.
    const t = window.setTimeout(() => { raf = requestAnimationFrame(measure); }, 200);
    return () => { window.clearTimeout(t); cancelAnimationFrame(raf); };
  }, [open, step, measure]);

  // Keep the spotlight glued to its target while the page moves underneath.
  React.useEffect(() => {
    if (!open) return;
    let raf = 0;
    const onMove = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => {
      window.removeEventListener('resize', onMove);
      window.removeEventListener('scroll', onMove, true);
      cancelAnimationFrame(raf);
    };
  }, [open, measure]);

  // Following a "Take me there" link mid-tour re-anchors instead of stranding the card.
  React.useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [pathname, open, measure]);

  const next = React.useCallback(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), []);
  const prev = React.useCallback(() => setStep((s) => Math.max(0, s - 1)), []);
  const close = React.useCallback(() => setOpen(false), []);

  // Arrow keys step through; Escape leaves.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, next, prev, close]);

  const start = () => { setStep(0); setOpen(true); };

  return (
    <>
      <button
        type="button"
        data-tour="tour-button"
        onClick={start}
        title="Take a tour — a quick guided walkthrough of the CRM"
        aria-label="Take a guided tour of the CRM"
        className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <HelpCircle className="h-4 w-4 shrink-0" />
        <span className="hidden text-xs font-medium xl:inline">Take a tour</span>
      </button>

      {open && current && (
        <div className="fixed inset-0 z-coach" role="dialog" aria-modal="true" aria-label="Guided tour">
          {/* Click-away layer. Transparent when a spotlight is showing, because
              the dimming is the spotlight's own shadow. */}
          <button
            type="button" aria-label="Close tour" onClick={close}
            className="absolute inset-0 h-full w-full cursor-default"
            style={rect ? undefined : { background: 'rgba(0,0,0,0.45)' }}
          />

          {/* The spotlight: a clear window whose huge shadow dims everything else. */}
          {rect && (
            <div
              aria-hidden
              className="pointer-events-none absolute rounded-lg ring-2 ring-primary/70"
              style={{
                top: rect.top, left: rect.left, width: rect.width, height: rect.height,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
                transition: 'top .28s cubic-bezier(.4,0,.2,1), left .28s cubic-bezier(.4,0,.2,1), width .28s cubic-bezier(.4,0,.2,1), height .28s cubic-bezier(.4,0,.2,1)',
              }}
            />
          )}

          {/* The travelling card — moved by transform, so no layout per frame. */}
          <div
            ref={cardRef}
            className="card-elevated absolute rounded-lg bg-background p-4 shadow-xl"
            style={{
              width: CARD_W,
              top: 0, left: 0,
              transform: `translate3d(${place?.x ?? 0}px, ${place?.y ?? 0}px, 0)`,
              transition: 'transform .28s cubic-bezier(.4,0,.2,1)',
              visibility: place ? 'visible' : 'hidden',
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                  Step {step + 1} of {STEPS.length}
                </p>
                <h2 className="mt-0.5 font-display text-base leading-snug">{current.title}</h2>
              </div>
              <button type="button" onClick={close} aria-label="Close tour" className="focus-ring -mr-1 -mt-1 rounded p-1 text-muted-foreground hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{current.body}</p>

            {current.href && (
              <Link href={current.href} onClick={close} className="mt-2.5 inline-flex items-center gap-1 text-sm font-medium text-primary underline">
                {current.hrefLabel ?? 'Take me there'} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}

            <div className="mt-4 flex items-center justify-center gap-1.5">
              {STEPS.map((s, i) => (
                <button
                  key={s.title} type="button" onClick={() => setStep(i)}
                  aria-label={`Go to step ${i + 1}: ${s.title}`}
                  className={`h-1.5 rounded-full transition-all ${i === step ? 'w-4 bg-primary' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60'}`}
                />
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button" onClick={prev} disabled={step === 0}
                className="focus-ring inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button type="button" onClick={close} className="text-xs text-muted-foreground underline hover:text-foreground">
                Skip
              </button>
              {isLast ? (
                <button type="button" onClick={close} className="focus-ring inline-flex items-center gap-1 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground">
                  <Check className="h-4 w-4" /> Done
                </button>
              ) : (
                <button type="button" onClick={next} className="focus-ring inline-flex items-center gap-1 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground">
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
