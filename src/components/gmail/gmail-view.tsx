'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Mail, Send, Loader2, RefreshCw, AlertTriangle, X, Reply } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { loadGmailInbox, readGmailMessage, sendGmail } from '@/server/actions/gmail';

interface Item { uid: number; from: string; fromName: string; subject: string; date: string; seen: boolean }
interface Msg { from: string; to: string; subject: string; date: string; text: string; html: string | null }

function emailOf(s: string): string {
  const m = s.match(/<([^>]+)>/);
  return (m?.[1] ?? s).trim();
}
function when(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function GmailView() {
  const [loading, setLoading] = React.useState(true);
  const [configured, setConfigured] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<Item[]>([]);
  const [active, setActive] = React.useState<Item | null>(null);
  const [msg, setMsg] = React.useState<Msg | null>(null);
  const [msgLoading, setMsgLoading] = React.useState(false);

  const [composeOpen, setComposeOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [preTo, setPreTo] = React.useState('');
  const [preSubject, setPreSubject] = React.useState('');

  const load = React.useCallback(() => {
    setLoading(true);
    setError(null);
    void (async () => {
      const r = await loadGmailInbox();
      setLoading(false);
      if ('error' in r) { setError(r.error); return; }
      setConfigured(r.configured);
      setItems(r.items);
    })();
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const open = (it: Item) => {
    setActive(it);
    setMsg(null);
    setMsgLoading(true);
    void (async () => {
      const r = await readGmailMessage(it.uid);
      setMsgLoading(false);
      if ('error' in r) { toast.error(r.error); return; }
      setMsg(r.message);
    })();
  };

  const startCompose = (to = '', subject = '') => { setPreTo(to); setPreSubject(subject); setComposeOpen(true); };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSending(true);
    void (async () => {
      const r = await sendGmail({ to: String(fd.get('to') || ''), subject: String(fd.get('subject') || ''), body: String(fd.get('body') || '') });
      setSending(false);
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Email sent'); setComposeOpen(false);
    })();
  };

  if (loading) {
    return <div className="flex items-center gap-2 rounded-lg border p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading your inbox…</div>;
  }

  if (!configured) {
    return (
      <div className="rounded-lg border p-6 text-sm">
        <p className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4 text-amber-600" /> Gmail inbox isn&apos;t switched on yet.</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>In Gmail, enable <strong>IMAP</strong> (Settings → Forwarding and POP/IMAP).</li>
          <li>Create a Google <strong>app password</strong> for mail.</li>
          <li>In Vercel, set <code className="rounded bg-muted px-1">IMAP_USER</code> (your Gmail) and <code className="rounded bg-muted px-1">IMAP_PASS</code> (the app password), then redeploy. If your SMTP already uses the same mailbox, those are reused automatically.</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</Button>
        <Button size="sm" onClick={() => startCompose()}><Mail className="h-4 w-4" /> New email</Button>
      </div>

      {error ? (
        <div className="rounded-lg border p-4 text-sm">
          <p className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /> {error}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={load}>Try again</Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
          {/* List */}
          <div className="rounded-lg border">
            <div className="max-h-[70vh] overflow-y-auto">
              {items.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Inbox is empty.</p>
              ) : (
                items.map((it) => (
                  <button
                    key={it.uid}
                    onClick={() => open(it)}
                    className={`flex w-full flex-col gap-0.5 border-b px-3 py-2.5 text-left hover:bg-muted/50 ${active?.uid === it.uid ? 'bg-muted' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${it.seen ? '' : 'font-semibold'}`}>{it.fromName || emailOf(it.from)}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{when(it.date)}</span>
                    </div>
                    <span className={`truncate text-xs ${it.seen ? 'text-muted-foreground' : 'font-medium'}`}>{it.subject}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Reader */}
          <div className="rounded-lg border">
            {!active ? (
              <p className="p-8 text-center text-sm text-muted-foreground">Pick an email on the left to read it.</p>
            ) : (
              <div className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-2 border-b p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{active.subject}</p>
                    <p className="truncate text-xs text-muted-foreground">{active.fromName ? `${active.fromName} · ` : ''}{emailOf(active.from)} · {when(active.date)}</p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => startCompose(emailOf(active.from), active.subject.startsWith('Re:') ? active.subject : `Re: ${active.subject}`)}>
                    <Reply className="h-4 w-4" /> Reply
                  </Button>
                </div>
                <div className="max-h-[60vh] flex-1 overflow-y-auto p-4">
                  {msgLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
                  ) : msg ? (
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm">{msg.text || '(This email has no plain-text version.)'}</pre>
                  ) : (
                    <p className="text-sm text-muted-foreground">Could not load this message.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {composeOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 pt-[10vh] overflow-y-auto overscroll-contain" role="dialog" aria-modal="true" aria-label="Compose email">
          <div className="w-full max-w-lg rounded-lg border bg-background p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /><h2 className="font-display text-lg">New email</h2></div>
              <button type="button" onClick={() => setComposeOpen(false)} aria-label="Close"><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <form onSubmit={submit} className="space-y-3">
              <Input name="to" type="email" required defaultValue={preTo} placeholder="To (email address)" autoFocus />
              <Input name="subject" defaultValue={preSubject} placeholder="Subject" />
              <Textarea name="body" required rows={8} placeholder="Write your message…" />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={sending} className="gap-1"><Send className="h-4 w-4" />{sending ? 'Sending…' : 'Send'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
