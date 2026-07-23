'use client';
import * as React from 'react';
import { RefreshCw, X } from 'lucide-react';
import { APP_VERSION } from '@/config/changelog';

/**
 * "A new version is ready" bar. The app boots with APP_VERSION baked into its
 * bundle; this polls /api/version (always fresh from the server) and, the moment
 * a newer version is deployed, shows a slim bar with one button. Tapping it
 * drops the cached shell and reloads — so a phone picks up the update in one tap,
 * with no reinstall and only the changed files re-downloaded.
 */
export function UpdateBanner() {
  const [latest, setLatest] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);

  React.useEffect(() => {
    let stop = false;

    const check = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string };
        if (!stop && data.version && data.version !== APP_VERSION) {
          setLatest(data.version);
        }
      } catch {
        /* offline or blocked — just try again later */
      }
    };

    check();
    const timer = setInterval(check, 3 * 60 * 1000); // every 3 minutes
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    return () => {
      stop = true;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const update = async () => {
    setBusy(true);
    try {
      // Tell any waiting service worker to take over, then wipe the old cached
      // shell so the reload pulls the new files instead of a stale copy.
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.update().catch(() => {});
        reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* best effort — reload regardless */
    }
    window.location.reload();
  };

  if (!latest || hidden) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-3 border-b border-[#A07D34]/40 bg-[#A07D34]/10 px-4 py-2 text-sm text-foreground sm:px-6"
    >
      <RefreshCw className="h-4 w-4 shrink-0 text-[#A07D34]" />
      <p className="min-w-0 flex-1">
        <span className="font-medium">A new version ({latest}) is ready.</span>{' '}
        <span className="text-muted-foreground">Update to get the latest — no reinstall needed.</span>
      </p>
      <button
        onClick={update}
        disabled={busy}
        className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[#A07D34] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        {busy ? 'Updating…' : 'Update now'}
      </button>
      <button
        onClick={() => setHidden(true)}
        aria-label="Dismiss"
        className="focus-ring shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
