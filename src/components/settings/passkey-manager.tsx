'use client';

import { useEffect, useState, useTransition } from 'react';
import { startRegistration, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { KeyRound, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  startPasskeyEnrollment, finishPasskeyEnrollment, myPasskeys, deletePasskey,
} from '@/server/actions/passkeys';

type Passkey = { id: string; label: string | null; createdAt: Date };

/** Guess a name for the key so nobody has to think of one. */
function deviceName(): string {
  if (typeof navigator === 'undefined') return 'Passkey';
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android phone';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows PC';
  return 'This device';
}

export function PasskeyManager() {
  const [keys, setKeys] = useState<Passkey[] | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();
  const supported = typeof window !== 'undefined' && browserSupportsWebAuthn();

  const load = () => { void myPasskeys().then(setKeys).catch(() => setKeys([])); };
  useEffect(load, []);

  const add = async () => {
    setBusy(true); setMsg(null);
    try {
      const options = await startPasskeyEnrollment();
      const response = await startRegistration({ optionsJSON: options });
      const r = await finishPasskeyEnrollment(response, deviceName());
      if ('error' in r) setMsg({ text: r.error, bad: true });
      else { setMsg({ text: 'Passkey added. You can now sign in with it.', bad: false }); load(); }
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setMsg({
        text: /NotAllowed|abort/i.test(m)
          ? 'Cancelled.'
          : /already registered|excluded/i.test(m)
            ? 'This device already has a passkey for Ameya Heights.'
            : m,
        bad: true,
      });
    } finally { setBusy(false); }
  };

  const remove = (id: string) =>
    start(async () => {
      const r = await deletePasskey(id);
      if ('error' in r) setMsg({ text: r.error, bad: true });
      else load();
    });

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4" />Passkeys</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Sign in with your face, fingerprint or device PIN instead of typing a password and a code.
            A passkey never leaves this device and cannot be given away to a fake site, which makes it
            the safest option here as well as the quickest.
          </p>
        </div>
        {supported && (
          <button
            type="button" onClick={add} disabled={busy}
            className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add a passkey
          </button>
        )}
      </div>

      {!supported && (
        <p className="mt-3 text-sm text-muted-foreground">This browser does not support passkeys.</p>
      )}

      {msg && (
        <p className={`mt-3 text-sm ${msg.bad ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>{msg.text}</p>
      )}

      <ul className="mt-4 space-y-2">
        {keys === null && <li className="text-sm text-muted-foreground">Loading…</li>}
        {keys?.length === 0 && <li className="text-sm text-muted-foreground">No passkeys yet.</li>}
        {keys?.map((k) => (
          <li key={k.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{k.label ?? 'Passkey'}</span>
              <span className="text-xs text-muted-foreground">
                Added {new Date(k.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </span>
            <button
              type="button" onClick={() => remove(k.id)}
              className="focus-ring rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="Remove this passkey"
            ><Trash2 className="h-4 w-4" /></button>
          </li>
        ))}
      </ul>
    </section>
  );
}
