'use client';

import { useCallback, useEffect, useState } from 'react';
import { CloudOff, RefreshCw, Check } from 'lucide-react';
import { flush, list, type Queued } from '@/lib/offline/queue';

/**
 * A quiet strip showing anything waiting to be sent, and whether the phone is
 * online. Hidden entirely when there is nothing queued and signal is fine.
 */
export function OfflineOutbox() {
  const [queued, setQueued] = useState<Queued[]>([]);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [justSent, setJustSent] = useState(0);

  const refresh = useCallback(async () => {
    try { setQueued(await list()); } catch { /* IndexedDB unavailable — nothing to show */ }
  }, []);

  const send = useCallback(async () => {
    setBusy(true);
    try {
      const r = await flush();
      if (r.sent) { setJustSent(r.sent); setTimeout(() => setJustSent(0), 4000); }
    } finally {
      setBusy(false);
      void refresh();
    }
  }, [refresh]);

  useEffect(() => {
    setOnline(navigator.onLine);
    void refresh();
    const goOnline = () => { setOnline(true); void send(); };
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    const timer = setInterval(() => { void refresh(); }, 20000);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      clearInterval(timer);
    };
  }, [refresh, send]);

  if (justSent > 0) {
    return (
      <div className="flex items-center gap-2 border-b bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Check className="h-4 w-4" />{justSent} item{justSent === 1 ? '' : 's'} sent now that you are back online.
      </div>
    );
  }
  if (online && queued.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
      <CloudOff className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        {online
          ? `${queued.length} item${queued.length === 1 ? '' : 's'} still to send.`
          : `No signal. ${queued.length ? `${queued.length} item${queued.length === 1 ? '' : 's'} saved on this phone — ` : ''}anything you write is kept and sent when you are back.`}
      </span>
      {online && queued.length > 0 && (
        <button
          type="button" onClick={() => void send()} disabled={busy}
          className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-amber-400/60 px-2.5 py-1 text-xs disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${busy ? 'animate-spin' : ''}`} />Send now
        </button>
      )}
    </div>
  );
}
