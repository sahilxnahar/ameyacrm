'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type Result = { ok?: true; message?: string } | { error: string } | void;

/**
 * One way to run a server action.
 *
 * Standardises the three things every call needs and that were previously
 * written slightly differently in every component: a pending flag, a toast
 * that says something useful, and a refresh afterwards. Network failures get a
 * message about the connection rather than a raw exception.
 */
export function useAction(options?: { refresh?: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  const run = React.useCallback(
    (fn: () => Promise<Result>, successMessage: string, key?: string) => {
      setBusyKey(key ?? null);
      start(async () => {
        try {
          const r = await fn();
          if (r && 'error' in r && r.error) {
            toast.error(r.error);
            return;
          }
          const custom = r && 'message' in r ? r.message : undefined;
          toast.success(custom || successMessage);
          if (options?.refresh !== false) router.refresh();
        } catch (err) {
          const offline = typeof navigator !== 'undefined' && !navigator.onLine;
          toast.error(
            offline
              ? 'You are offline. Nothing was saved — try again once you have signal.'
              : err instanceof Error ? err.message : 'Something went wrong. Please try again.',
          );
        } finally {
          setBusyKey(null);
        }
      });
    },
    [router, options?.refresh],
  );

  return { run, pending, busyKey, isBusy: (key: string) => pending && busyKey === key };
}
