'use client';

import { useState, useTransition } from 'react';
import { MailWarning, Send, BellOff, Loader2, AlertTriangle } from 'lucide-react';
import { resendInvite, stopInviteReminders } from '@/server/actions/onboarding';

export interface PendingInvite {
  userId: string; name: string; email: string; username: string;
  invitedAt: string; reminders: number; welcomeSent: boolean; linkExpired: boolean; lastError: string | null;
}

const since = (iso: string) => {
  const h = Math.round((Date.now() - new Date(iso).getTime()) / 36e5);
  if (h < 1) return 'just now';
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
};

export function PendingInvites({ invites }: { invites: PendingInvite[] }) {
  const [rows, setRows] = useState(invites);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  if (!rows.length) return null;

  const act = (id: string, fn: () => Promise<{ ok: true; message: string } | { error: string }>, drop = false) =>
    start(async () => {
      setBusy(id);
      const res = await fn();
      setBusy(null);
      if ('error' in res) { setMsg({ kind: 'err', text: res.error }); return; }
      setMsg({ kind: 'ok', text: res.message });
      if (drop) setRows((r) => r.filter((x) => x.userId !== id));
    });

  return (
    <div className="card-elevated mb-6 overflow-hidden border-amber-400/50">
      <div className="flex items-start gap-3 border-b bg-amber-50/60 p-4 dark:bg-amber-950/20">
        <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-500" />
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {rows.length} {rows.length === 1 ? 'person has' : 'people have'} not signed in yet
          </p>
          <p className="text-sm text-muted-foreground">
            They are being emailed every hour until they do. Reminders stop by themselves after three days.
          </p>
        </div>
      </div>

      {msg && (
        <p className={`px-4 py-2 text-sm ${msg.kind === 'ok' ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive'}`}>{msg.text}</p>
      )}

      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.userId} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{r.name} <span className="font-normal text-muted-foreground">· {r.username}</span></p>
              <p className="truncate text-sm text-muted-foreground">{r.email}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Invited {since(r.invitedAt)} · {r.reminders} reminder{r.reminders === 1 ? '' : 's'} sent
                {r.linkExpired && <span className="ml-1 text-amber-700 dark:text-amber-500">· set-password link expired</span>}
                {!r.welcomeSent && <span className="ml-1 text-destructive">· the welcome email never sent</span>}
              </p>
              {r.lastError && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3 w-3" />{r.lastError}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button" disabled={busy === r.userId}
                onClick={() => act(r.userId, () => resendInvite(r.userId))}
                className="focus-ring inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
              >
                {busy === r.userId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send again
              </button>
              <button
                type="button" disabled={busy === r.userId}
                onClick={() => act(r.userId, () => stopInviteReminders(r.userId), true)}
                title="Stop the hourly emails without touching their account"
                className="focus-ring inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
              >
                <BellOff className="h-4 w-4" />Stop
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
