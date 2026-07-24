'use client';

import { useState } from 'react';
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { KeyRound, Loader2 } from 'lucide-react';
import { startPasskeyLogin, finishPasskeyLogin } from '@/server/actions/passkeys';

/**
 * Sign in with a passkey — face, fingerprint or device PIN.
 *
 * Hidden entirely on browsers that cannot do it, because an button that can
 * only fail is worse than no button.
 */
export function PasskeySignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported] = useState(() => (typeof window === 'undefined' ? true : browserSupportsWebAuthn()));

  if (!supported) return null;

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const options = await startPasskeyLogin();
      const response = await startAuthentication({ optionsJSON: options });
      const res = await finishPasskeyLogin(response);
      // A successful sign-in redirects, so anything returned is a failure.
      if (res && 'error' in res) setError(res.error);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        /NotAllowed|abort/i.test(msg)
          ? 'Cancelled. You can use your password instead.'
          : 'No passkey was available on this device. Sign in with your password, then add one under Security.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative py-1 text-center">
        <span className="relative z-10 bg-card px-2 text-xs text-muted-foreground">or</span>
        <span className="absolute inset-x-0 top-1/2 border-t border-border" />
      </div>
      <button
        type="button" onClick={go} disabled={busy}
        className="focus-ring flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
        Sign in with a passkey
      </button>
      {error && <p className="text-center text-xs text-destructive">{error}</p>}
    </div>
  );
}
