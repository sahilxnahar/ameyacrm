'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Eye, EyeOff, Check } from 'lucide-react';
import { setPasswordFromInvite } from '@/server/actions/onboarding';

export function SetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await setPasswordFromInvite({ token, password, confirm });
      if ('error' in res) { setError(res.error); return; }
      setDone(true);
      setTimeout(() => router.push('/login'), 1400);
    });
  };

  if (done) {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Check className="h-4 w-4" />Password set. Taking you to sign in…
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">New password</span>
        <div className="relative mt-1">
          <input
            type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password" required minLength={8}
            className="focus-ring w-full rounded-md border bg-background px-3 py-2 pr-10 text-base"
          />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}
            className="focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <span className={`mt-1 block text-xs ${tooShort ? 'text-destructive' : 'text-muted-foreground'}`}>
          At least 8 characters. Length beats complexity — a short phrase you will remember is fine.
        </span>
      </label>

      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">Type it again</span>
        <input
          type={show ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password" required
          className="focus-ring mt-1 w-full rounded-md border bg-background px-3 py-2 text-base"
        />
        {mismatch && <span className="mt-1 block text-xs text-destructive">These do not match.</span>}
      </label>

      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <button
        type="submit" disabled={pending || password.length < 8 || password !== confirm}
        className="focus-ring w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Set my password'}
      </button>
    </form>
  );
}
