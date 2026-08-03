'use client';
import * as React from 'react';
import Link from 'next/link';
import { Sparkles, X } from 'lucide-react';
import { APP_VERSION } from '@/config/version';
import type { Release } from '@/config/changelog';

const KEY = 'amh:seen-version';

/** How many highlights to show before pointing at the full list. */
const MAX_SHOWN = 6;

/**
 * Shows the latest "what's new" once after an upgrade — but only to people who
 * have used the app before (a stored older version). A brand-new user just has
 * the version recorded silently, so they are not shown a changelog for changes
 * they never experienced.
 *
 * ── Why this file is careful about height ──────────────────────────────────
 *
 * This panel had no height cap, no scrolling, and it centred itself in the
 * viewport. A centred flex child that is taller than its container overflows
 * EQUALLY off the top and the bottom, and neither end can be scrolled to. So on
 * a 705px-tall window a 929px panel put its close button 89px above the screen
 * and its "Got it" button 51px below it, and there was no way to dismiss it.
 *
 * That alone would be a bad bug. What made it serious is the loop: the version
 * is marked seen when you dismiss, so a panel that cannot be dismissed comes
 * back on every single page load, for ever. The whole CRM became unusable
 * behind an un-closeable changelog.
 *
 * Three independent things now prevent that, because one is not enough for
 * something that can lock a person out of the entire application:
 *
 *   1. The panel cannot outgrow the window. It is capped at 85% of the dynamic
 *      viewport height, the header and the button are pinned, and only the list
 *      between them scrolls.
 *   2. There are four ways out — the close button, "Got it", Escape, and
 *      clicking the backdrop.
 *   3. The version is recorded as seen the moment the panel is SHOWN, not when
 *      it is dismissed. If every one of the above were somehow broken again, the
 *      worst case is one stuck screen that a reload clears — never a permanent
 *      loop.
 */
export function WhatsNew() {
  const [show, setShow] = React.useState(false);
  // Loaded on demand. The changelog is 125KB of prose — every release note ever
  // written — and it was imported at the top of this file, which sits in the app
  // shell. That put all 125KB into the client bundle of every signed-in screen,
  // on every navigation, to render a panel almost nobody sees on almost every
  // visit. It is now fetched only in the one case where it is about to be shown.
  const [release, setRelease] = React.useState<Release | null>(null);

  React.useEffect(() => {
    let seen: string | null = null;
    try { seen = localStorage.getItem(KEY); } catch { seen = null; }
    if (!seen) {
      try { localStorage.setItem(KEY, APP_VERSION); } catch { /* ignore */ }
      return;
    }
    if (seen === APP_VERSION) return;
    // Recorded on show, deliberately — see the note above. Being told about a
    // release once and missing it is a triviality; being unable to reach any
    // screen in the CRM is not.
    try { localStorage.setItem(KEY, APP_VERSION); } catch { /* ignore */ }
    let live = true;
    void import('@/config/changelog').then((m) => {
      if (!live) return;
      const r = m.CHANGELOG[0];
      if (r) { setRelease(r); setShow(true); }
    }).catch(() => undefined);
    return () => { live = false; };
  }, []);

  const dismiss = React.useCallback(() => setShow(false), []);

  // Escape closes it, as it does every other overlay in the app.
  React.useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') dismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show, dismiss]);

  if (!show || !release) return null;

  const shown = release.highlights.slice(0, MAX_SHOWN);
  const hidden = release.highlights.length - shown.length;

  return (
    <div
      className="fixed inset-0 z-coach flex items-end justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-label={`What's new in ${release.version}`}
    >
      {/*
        `max-h-[85dvh]` with `flex-col` and a scrolling middle is what keeps the
        two dismiss controls on screen at any window height. `my-auto` rather
        than pure centring means that if a future browser still manages to make
        this taller than the viewport, the overlay's own `overflow-y-auto` can
        scroll to it instead of clipping it away.
      */}
      <div
        className="my-auto flex max-h-[85dvh] w-full max-w-md flex-col rounded-xl border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b p-5 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-4 w-4 text-brass" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold">What&rsquo;s new</h2>
              <p className="text-xs text-muted-foreground">{release.version} · {release.date}</p>
            </div>
          </div>
          <button
            aria-label="Close"
            onClick={dismiss}
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-5 py-4">
          {shown.map((h, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{h}</span>
            </li>
          ))}
          {hidden > 0 && (
            <li className="pt-1 text-sm">
              <Link href="/updates" onClick={dismiss} className="font-medium text-brass hover:underline">
                and {hidden} more {hidden === 1 ? 'change' : 'changes'} in this release &rarr;
              </Link>
            </li>
          )}
        </ul>

        <div className="shrink-0 border-t p-5 pt-3">
          <button
            onClick={dismiss}
            className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
