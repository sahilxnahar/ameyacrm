'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Loader2, MailCheck } from 'lucide-react';
import { requestPasswordReset } from '@/server/actions/password-reset';

export function ForgotPasswordForm() {
  const [identifier, setIdentifier] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    start(async () => {
      const res = await requestPasswordReset(identifier);
      if (res.error) { setError(res.error); return; }
      setMessage(res.message ?? 'If that account exists, a reset link is on its way.');
    });
  };

  if (message) {
    return (
      <div className="mt-4 space-y-3">
        <p className="flex items-start gap-2 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />{message}
        </p>
        <Link href="/login" className="block text-center text-sm font-medium underline">Back to sign in</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <label className="block">
        <span className="text-xs font-medium text-muted-foreground">Username or email</span>
        <input
          type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username" required autoFocus
          className="focus-ring mt-1 w-full rounded-md border bg-background px-3 py-2 text-base"
        />
      </label>

      {error && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <button
        type="submit" disabled={pending || identifier.trim().length === 0}
        className="focus-ring w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Email me a reset link'}
      </button>

      <Link href="/login" className="block text-center text-sm text-muted-foreground underline">Back to sign in</Link>
    </form>
  );
}
