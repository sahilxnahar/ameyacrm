'use client';

import * as React from 'react';
import Link from 'next/link';
import { MailWarning, X } from 'lucide-react';

/**
 * "Email is not actually sending" — said once, where people will see it.
 *
 * With EMAIL_PROVIDER unset the app defaults to `console`: every message is
 * written to the server log and silently dropped. Everything downstream then
 * lies quietly — payment reminders "sent", MSME notices "delivered", a welcome
 * email that never arrives — and the only place that says otherwise was buried
 * on two screens most people never open. A dormant mail transport is a
 * company-wide fact, so it belongs on the shell.
 *
 * Shown to admins only (nobody else can fix it), and dismissible for the day so
 * it nags without becoming furniture.
 */
export function EmailDormantBanner({ show }: { show: boolean }) {
  const KEY = 'amh:email-dormant-dismissed';
  const [hidden, setHidden] = React.useState(true);

  React.useEffect(() => {
    if (!show) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      setHidden(window.localStorage.getItem(KEY) === today);
    } catch {
      setHidden(false);
    }
  }, [show]);

  if (!show || hidden) return null;

  const dismiss = () => {
    try { window.localStorage.setItem(KEY, new Date().toISOString().slice(0, 10)); } catch { /* ignore */ }
    setHidden(true);
  };

  return (
    <div className="mb-4 flex items-start gap-3 rounded-md border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-900 dark:text-rose-200">
      <MailWarning className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">No email is leaving this system.</p>
        <p className="text-rose-800/90 dark:text-rose-300/90">
          Mail is being written to the server log instead of sent, so payment reminders, MSME notices and
          invitations are all going nowhere — even where the screen says they were sent. Set{' '}
          <code className="rounded bg-rose-500/15 px-1 py-0.5 text-xs">EMAIL_PROVIDER</code> and the mail
          credentials to fix it.{' '}
          <Link href="/admin/email-health" className="font-semibold underline">Check mail settings</Link>.
        </p>
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss for today" className="focus-ring rounded p-1 text-rose-700/80 hover:bg-rose-500/20">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
