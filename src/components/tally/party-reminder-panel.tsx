'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Mail, AlertTriangle, Send } from 'lucide-react';
import { savePartyReminder, sendTestReminder, getPartyReminder, previewPartyReminder } from '@/server/actions/party-reminders';

/**
 * Set how often one party gets chased.
 *
 * Two warnings are shown rather than hidden, because both mean "nothing will
 * actually reach anyone" and finding that out weeks later — having believed
 * your debtors were being chased — is far worse than a visible notice now.
 */
const CADENCE_OPTIONS = [
  ['OFF', 'Do not chase automatically'],
  ['WEEKLY', 'Every week'],
  ['FORTNIGHTLY', 'Every two weeks'],
  ['MONTHLY', 'Every month'],
] as const;

export function PartyReminderPanel({ ledgerId, party, onClose }: { ledgerId: string; party: string; onClose: () => void }) {
  const [state, setState] = React.useState<Awaited<ReturnType<typeof getPartyReminder>> | null>(null);
  const [f, setF] = React.useState({ email: '', ccEmail: '', cadence: 'OFF', onlyWhenOverdue: true, note: '', pausedUntil: '' });
  const [preview, setPreview] = React.useState<string | null>(null);
  const [pending, start] = React.useTransition();

  React.useEffect(() => {
    start(async () => {
      const s = await getPartyReminder(ledgerId);
      setState(s);
      if ('ok' in s && s.reminder) {
        setF({
          email: s.reminder.email, ccEmail: s.reminder.ccEmail ?? '', cadence: s.reminder.cadence,
          onlyWhenOverdue: s.reminder.onlyWhenOverdue, note: s.reminder.note ?? '',
          pausedUntil: s.reminder.pausedUntil ?? '',
        });
      }
    });
  }, [ledgerId]);

  const save = () => start(async () => {
    const r = await savePartyReminder({ ledgerId, ...f });
    if ('error' in r) { toast.error(r.error); return; }
    toast.success(r.message ?? 'Saved');
    setState(await getPartyReminder(ledgerId));
  });

  const test = () => start(async () => {
    const r = await sendTestReminder(ledgerId);
    if ('error' in r) { toast.error(r.error); return; }
    toast.success(r.message ?? 'Test sent');
  });

  const showPreview = () => start(async () => {
    const r = await previewPartyReminder(ledgerId);
    if ('error' in r) { toast.error(r.error); return; }
    setPreview(r.text);
  });

  const globalOff = state && 'ok' in state && !state.globalOn;
  const emailOff = state && 'ok' in state && !state.emailConfigured;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={`Payment reminders for ${party}`}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default" />
      <div className="card-elevated relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-background p-5 shadow-xl">
        <h2 className="flex items-center gap-2 font-display text-lg"><Mail className="h-4 w-4 text-primary" /> Chase {party}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          An email goes out on this schedule for as long as money is outstanding, and stops on its own once the balance is clear.
        </p>

        {emailOff && (
          <p className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span><strong>Email is not set up yet</strong>, so nothing can actually send. Set <code>EMAIL_PROVIDER</code> and the mail credentials first — until then this schedule is saved but dormant.</span>
          </p>
        )}
        {globalOff && !emailOff && (
          <p className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>Automatic reminders are <strong>switched off for everyone</strong>. Turn them on in Settings when you are ready.</span>
          </p>
        )}

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="font-medium">Send to</span>
            <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="buyer@example.com" type="email"
              className="mt-1 w-full rounded-md border bg-background px-2.5 py-1.5 text-sm" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Copy to (optional)</span>
            <input value={f.ccEmail} onChange={(e) => setF({ ...f, ccEmail: e.target.value })} placeholder="accounts@ameyaheights.com" type="email"
              className="mt-1 w-full rounded-md border bg-background px-2.5 py-1.5 text-sm" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">How often</span>
            <select value={f.cadence} onChange={(e) => setF({ ...f, cadence: e.target.value })}
              className="mt-1 w-full rounded-md border bg-background px-2.5 py-1.5 text-sm">
              {CADENCE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={f.onlyWhenOverdue} onChange={(e) => setF({ ...f, onlyWhenOverdue: e.target.checked })} className="mt-0.5 h-4 w-4" />
            <span>Only once a bill is actually overdue <span className="text-muted-foreground">— chasing money that is not yet due tends to irritate good payers.</span></span>
          </label>
          <label className="block text-sm">
            <span className="font-medium">Pause until (optional)</span>
            <input type="date" value={f.pausedUntil} onChange={(e) => setF({ ...f, pausedUntil: e.target.value })}
              className="mt-1 w-full rounded-md border bg-background px-2.5 py-1.5 text-sm" />
            <span className="text-[11px] text-muted-foreground">For when they have promised a date.</span>
          </label>
          <label className="block text-sm">
            <span className="font-medium">A line to add (optional)</span>
            <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Regarding Tower A, flat 1204"
              className="mt-1 w-full rounded-md border bg-background px-2.5 py-1.5 text-sm" />
          </label>
        </div>

        {state && 'ok' in state && state.reminder && state.reminder.sentCount > 0 && (
          <div className="mt-4 rounded-md border bg-secondary/30 p-2.5 text-sm">
            <p className="font-medium">Chased {state.reminder.sentCount} time{state.reminder.sentCount === 1 ? '' : 's'}{state.reminder.lastSentAt ? `, last on ${state.reminder.lastSentAt}` : ''}</p>
            <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
              {state.reminder.sends.map((s, i) => (
                <li key={i}>{s.at} — ₹{s.amount.toLocaleString('en-IN')} {s.ok ? '' : `(failed: ${s.error ?? 'unknown'})`}</li>
              ))}
            </ul>
          </div>
        )}

        {preview && (
          <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-md border bg-secondary/30 p-2.5 text-[11px] leading-relaxed">{preview}</pre>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button type="button" onClick={showPreview} disabled={pending} className="focus-ring rounded-md border px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-50">
              See what they get
            </button>
            <button type="button" onClick={test} disabled={pending} className="focus-ring inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-50">
              <Send className="h-3.5 w-3.5" /> Send me a test
            </button>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="focus-ring rounded-md border px-3 py-1.5 text-sm">Cancel</button>
            <button type="button" onClick={save} disabled={pending} className="focus-ring rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}
