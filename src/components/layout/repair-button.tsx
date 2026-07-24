'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Wrench } from 'lucide-react';
import { repairDatabase } from '@/server/actions/company';

/**
 * One click to bring the database up to date.
 *
 * It runs through the app's own connection, so it cannot be aimed at the wrong
 * Neon branch — the commonest reason pasting the SQL by hand appears to do
 * nothing at all.
 */
export function RepairButton() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      setMsg(null);
      const res = await repairDatabase();
      if ('error' in res) { setBad(true); setMsg(res.error); return; }
      setBad(false);
      setMsg(res.message);
      setTimeout(() => router.refresh(), 1200);
    });

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button" onClick={run} disabled={pending}
        className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-destructive/50 bg-background px-2.5 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
      >
        {pending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Repairing…</> : <><Wrench className="h-3.5 w-3.5" />Fix it now</>}
      </button>
      {msg && <span className={bad ? 'text-xs' : 'text-xs text-emerald-700 dark:text-emerald-400'}>{msg}</span>}
    </span>
  );
}
