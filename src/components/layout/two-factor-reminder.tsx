'use client';

import * as React from 'react';
import Link from 'next/link';
import { ShieldAlert, X } from 'lucide-react';

/**
 * A prominent but dismissible reminder that 2FA still needs setting up.
 *
 * This replaces the old hard redirect that trapped people on the security page
 * on every visit. People are greeted with their home screen; 2FA is still
 * required (and enforced by an email reminder), but it no longer hides the CRM
 * behind a wall on every navigation. Enrolled users never see this. Dismissing
 * it hides it for the day, per device.
 */
export function TwoFactorReminder({ show }: { show: boolean }) {
  const KEY = 'amh:2fa-reminder-dismissed';
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
    <div className="mb-4 flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Two-factor authentication isn&apos;t set up yet.</p>
        <p className="text-amber-800/90 dark:text-amber-300/90">
          It&apos;s required for your account. It takes a minute and protects everything here.{' '}
          <Link href="/settings/security?enroll=1" className="font-semibold underline">Set it up now</Link>.
        </p>
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss for today" className="focus-ring rounded p-1 text-amber-700/80 hover:bg-amber-500/20">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
