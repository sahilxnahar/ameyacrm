'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Mail, Plug, CheckCircle2, Trash2, Send, AlertTriangle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { saveMyImap, testMyImap, clearMyImap } from '@/server/actions/user-imap';
import { saveMyOutbound, sendMyTestEmail } from '@/server/actions/user-smtp';
import type { UserImapStatus } from '@/server/services/user-imap-service';
import type { UserSmtpStatus } from '@/server/services/user-smtp-service';

export function EmailSettingsView({ status, outbound, defaultEmail }: { status: UserImapStatus; outbound: UserSmtpStatus; defaultEmail: string }) {
  // AMH-029 — router.refresh() re-runs the server components and swaps the
  // new HTML in. router.refresh() threw the whole document away: scroll
  // position, open filters, a half-typed field in another panel, and a
  // second of white screen. The server action already calls revalidatePath,
  // so the data is fresh either way.
  const router = useRouter();
  const [host, setHost] = React.useState(status.host ?? 'imap.gmail.com');
  const [port, setPort] = React.useState(status.port ?? 993);
  const [user, setUser] = React.useState(status.source === 'user' ? (status.user ?? '') : defaultEmail);
  const [pass, setPass] = React.useState('');
  const [busy, setBusy] = React.useState<null | 'save' | 'test'>(null);

  // Outbound (send-as-me) state.
  const [sendAsSelf, setSendAsSelf] = React.useState(outbound.source === 'user' ? true : outbound.sendsAsSelf);
  const [advOpen, setAdvOpen] = React.useState(false);
  const [smtpHost, setSmtpHost] = React.useState(outbound.host ?? '');
  const [smtpPort, setSmtpPort] = React.useState<number | ''>(outbound.port ?? '');
  const [outBusy, setOutBusy] = React.useState<null | 'save' | 'test'>(null);

  function save() {
    if (!user.trim()) { toast.error('Enter your email / IMAP username.'); return; }
    setBusy('save');
    saveMyImap({ host, port, user, pass }).then((r) => {
      setBusy(null);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Connected — your inbox is now syncing'); setPass(''); router.refresh();
    })
      .catch(() => {
        // A rejected server action never reaches .then, so the flag the
        // success path clears was never cleared: the button stayed disabled
        // with a spinner until someone reloaded the page.
        setBusy(null);
        toast.error('Could not reach the server. Nothing was saved — check your connection and try again.');
      });
  }
  function test() {
    setBusy('test');
    testMyImap().then((r) => { setBusy(null); if ('error' in r) { toast.error(r.error); return; } toast.success(`Connection OK (${r.source === 'user' ? 'your mailbox' : 'org mailbox'})`); })
      .catch(() => {
        // A rejected server action never reaches .then, so the flag the
        // success path clears was never cleared: the button stayed disabled
        // with a spinner until someone reloaded the page.
        setBusy(null);
        toast.error('Could not reach the server. Nothing was saved — check your connection and try again.');
      });
  }
  function disconnect() {
    clearMyImap().then((r) => { if ('error' in r) { toast.error(r.error); return; } toast.success('Disconnected'); router.refresh(); });
  }

  function saveOutbound(next: boolean) {
    setSendAsSelf(next);
    setOutBusy('save');
    saveMyOutbound({ sendAsSelf: next, smtpHost: smtpHost || undefined, smtpPort: smtpPort === '' ? undefined : Number(smtpPort) }).then((r) => {
      setOutBusy(null);
      if ('error' in r) { toast.error(r.error); setSendAsSelf(!next); return; }
      toast.success(next ? 'Your sent mail now goes out as you' : 'Reverted to the shared org sender'); router.refresh();
    })
      .catch(() => {
        // A rejected server action never reaches .then, so the flag the
        // success path clears was never cleared: the button stayed disabled
        // with a spinner until someone reloaded the page.
        setOutBusy(null);
        toast.error('Could not reach the server. Nothing was saved — check your connection and try again.');
      });
  }
  function testSend() {
    setOutBusy('test');
    sendMyTestEmail().then((r) => { setOutBusy(null); if ('error' in r) { toast.error(r.error); return; } toast.success(`Test sent — check your inbox. From: ${r.from}`); })
      .catch(() => {
        // A rejected server action never reaches .then, so the flag the
        // success path clears was never cleared: the button stayed disabled
        // with a spinner until someone reloaded the page.
        setOutBusy(null);
        toast.error('Could not reach the server. Nothing was saved — check your connection and try again.');
      });
  }

  const inboxConnected = status.source === 'user';

  return (
    <div className="max-w-xl space-y-6">
      {/* ---- Inbound (IMAP) ---- */}
      <div className="flex flex-wrap items-center gap-2">
        {status.source === 'user' ? <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Your mailbox connected</Badge>
          : status.source === 'org' ? <Badge variant="secondary" className="gap-1"><Mail className="h-3.5 w-3.5" /> Using the shared org mailbox</Badge>
          : <Badge variant="warning">No mailbox configured</Badge>}
        {status.user ? <span className="text-sm text-muted-foreground">{status.user}</span> : null}
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <div className="text-sm font-semibold">Inbound — your inbox (IMAP)</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Email / IMAP username</Label><Input value={user} onChange={(e) => setUser(e.target.value)} placeholder="you@ameyaheights.com" /></div>
          <div><Label>IMAP host</Label><Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="imap.gmail.com" /></div>
          <div><Label>Port</Label><Input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} /></div>
          <div className="col-span-2"><Label>App password</Label><Input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={status.source === 'user' ? 'leave blank to keep the saved one' : 'Gmail app password'} /></div>
        </div>
        <p className="text-xs text-muted-foreground">Gmail: turn on IMAP and create an <b>app password</b> (not your login password). Your password is encrypted at rest and never shown again. Host defaults to <code>imap.gmail.com:993</code>. The same app password is reused for sending — no need to enter it twice.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={busy !== null} className="gap-1"><Plug className="h-4 w-4" /> {busy === 'save' ? 'Connecting…' : 'Save & connect'}</Button>
          <Button variant="outline" onClick={test} disabled={busy !== null} className="gap-1"><CheckCircle2 className="h-4 w-4" /> {busy === 'test' ? 'Testing…' : 'Test connection'}</Button>
          {status.source === 'user' ? <Button variant="ghost" onClick={disconnect} className="gap-1 text-destructive"><Trash2 className="h-4 w-4" /> Disconnect</Button> : null}
        </div>
      </div>

      {/* ---- Outbound (send as me) ---- */}
      <div className="space-y-4 rounded-lg border p-4">
        <div className="toolbar items-center gap-2">
          <div className="text-sm font-semibold">Outbound — how your sent mail leaves</div>
          {outbound.source === 'user'
            ? <Badge variant="success" className="gap-1"><Send className="h-3.5 w-3.5" /> Sends as you</Badge>
            : <Badge variant="secondary" className="gap-1"><Mail className="h-3.5 w-3.5" /> Shared org sender</Badge>}
        </div>

        <div className="rounded-md bg-muted/40 px-3 py-2 text-sm">
          Mail you send from the CRM currently goes out as{' '}
          <b className="font-medium">{outbound.fromAddress ?? 'no sender configured'}</b>.
        </div>

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0"
            checked={sendAsSelf}
            disabled={outBusy !== null}
            onChange={(e) => saveOutbound(e.target.checked)}
          />
          <span className="text-sm">
            <span className="font-medium">Send as me</span>
            <span className="block text-xs text-muted-foreground">Use my own address ({defaultEmail}) and app password to send, instead of the shared mailbox. Recipients see mail from me and replies come back to my inbox.</span>
          </span>
        </label>

        {sendAsSelf && !inboxConnected ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Connect your inbox above first — sending reuses that same app password. Until then mail still uses the shared sender.
          </div>
        ) : null}

        <div>
          <button type="button" onClick={() => setAdvOpen((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${advOpen ? 'rotate-180' : ''}`} /> Advanced SMTP (optional — only if not Gmail)
          </button>
          {advOpen ? (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div><Label>SMTP host</Label><Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com (auto)" /></div>
              <div><Label>SMTP port</Label><Input type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value === '' ? '' : Number(e.target.value))} placeholder="465" /></div>
              <p className="col-span-2 text-xs text-muted-foreground">Leave blank and we derive it from your IMAP host (<code>imap.…</code> → <code>smtp.…</code>, port 465/SSL). Override only for a non-standard provider.</p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => saveOutbound(sendAsSelf)} disabled={outBusy !== null} className="gap-1"><Plug className="h-4 w-4" /> {outBusy === 'save' ? 'Saving…' : 'Save outbound'}</Button>
          <Button variant="outline" onClick={testSend} disabled={outBusy !== null || !inboxConnected} className="gap-1"><Send className="h-4 w-4" /> {outBusy === 'test' ? 'Sending…' : 'Send test to myself'}</Button>
        </div>
      </div>
    </div>
  );
}
