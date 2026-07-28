'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { BellRing, X, Loader2 } from 'lucide-react';

/**
 * A gentle, one-time prompt (mobile and desktop) asking to turn on
 * notifications, wired to the same push subscription the settings page uses.
 *
 * It only appears when the browser supports push AND permission hasn't been
 * decided yet (`Notification.permission === 'default'`) AND the person hasn't
 * dismissed it recently. "Not now" hides it for 14 days. Once granted or denied
 * by the browser, it never nags again — that decision is the browser's to keep.
 */
function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

const SNOOZE_KEY = 'amh:notif-prompt-snoozed-until';

export function NotificationPrompt() {
  const [visible, setVisible] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported) return;
    if (Notification.permission !== 'default') return; // already granted or denied — don't nag
    try {
      const until = Number(window.localStorage.getItem(SNOOZE_KEY) || 0);
      if (until && Date.now() < until) return;
    } catch { /* ignore */ }
    // Appear a moment after load so it doesn't fight the first paint.
    const t = window.setTimeout(() => setVisible(true), 2500);
    return () => window.clearTimeout(t);
  }, []);

  const snooze = () => {
    try { window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + 14 * 86400000)); } catch { /* ignore */ }
    setVisible(false);
  };

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { toast.message('No problem — you can turn these on later in Settings.'); setVisible(false); return; }
      const keyRes = await fetch('/api/push/subscribe');
      const { key } = await keyRes.json();
      if (!key) { toast.error('Notifications aren’t configured on the server yet.'); setVisible(false); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      const json = sub.toJSON();
      const res = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }) });
      if (!res.ok) throw new Error();
      toast.success('Notifications enabled on this device.');
      setVisible(false);
    } catch {
      toast.error('Could not enable notifications. You can try again from Settings.');
      setVisible(false);
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-dock mx-auto max-w-sm sm:inset-x-auto sm:right-4 sm:bottom-[8.5rem]">
      <div className="card-elevated flex items-start gap-3 rounded-lg border bg-background p-4 shadow-xl">
        <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary"><BellRing className="h-4 w-4" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Turn on notifications?</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Get alerted about approvals, overdue payments and messages — even when the CRM isn&apos;t open.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={enable} disabled={busy} className="focus-ring inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />} Enable
            </button>
            <button type="button" onClick={snooze} disabled={busy} className="focus-ring rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-secondary">Not now</button>
          </div>
        </div>
        <button type="button" onClick={snooze} aria-label="Dismiss" className="focus-ring rounded p-1 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
