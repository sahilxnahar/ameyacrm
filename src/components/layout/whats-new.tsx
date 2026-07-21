'use client';
import * as React from 'react';
import { Sparkles, X } from 'lucide-react';
import { APP_VERSION, CHANGELOG } from '@/config/changelog';

const KEY = 'amh:seen-version';

/**
 * Shows the latest "what's new" once after an upgrade — but only to people who
 * have used the app before (a stored older version). A brand-new user just has
 * the version recorded silently, so they are not shown a changelog for changes
 * they never experienced.
 */
export function WhatsNew() {
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    let seen: string | null = null;
    try { seen = localStorage.getItem(KEY); } catch { seen = null; }
    if (!seen) {
      try { localStorage.setItem(KEY, APP_VERSION); } catch { /* ignore */ }
      return;
    }
    if (seen !== APP_VERSION) setShow(true);
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(KEY, APP_VERSION); } catch { /* ignore */ }
    setShow(false);
  };

  if (!show) return null;
  const release = CHANGELOG[0];
  if (!release) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-xl border bg-card p-5 shadow-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10"><Sparkles className="h-4 w-4 text-[#A07D34]" /></span>
            <div>
              <h2 className="font-display text-lg font-semibold">What's new</h2>
              <p className="text-xs text-muted-foreground">{release.version} · {release.date}</p>
            </div>
          </div>
          <button aria-label="Close" onClick={dismiss} className="rounded p-1 text-muted-foreground hover:bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <ul className="mt-3 space-y-2">
          {release.highlights.map((h, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{h}</span>
            </li>
          ))}
        </ul>
        <button onClick={dismiss} className="mt-4 w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground">Got it</button>
      </div>
    </div>
  );
}
