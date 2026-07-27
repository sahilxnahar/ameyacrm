'use client';
import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Mail, MessageCircle, Send, ExternalLink, Inbox as InboxIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { loadInboxThread, replyEmailThread, replyWhatsappThread, composeEmail } from '@/server/actions/inbox';
import type { ThreadSummary, ThreadMessage, InboxChannel } from '@/server/services/inbox-service';

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - d) / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export function InboxView({ threads }: { threads: ThreadSummary[] }) {
  const [channel, setChannel] = React.useState<InboxChannel>('EMAIL');
  const [active, setActive] = React.useState<ThreadSummary | null>(null);
  const [messages, setMessages] = React.useState<ThreadMessage[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [subject, setSubject] = React.useState('');
  const [reply, setReply] = React.useState('');
  const [, start] = React.useTransition();
  const [sending, setSending] = React.useState(false);
  const [composeOpen, setComposeOpen] = React.useState(false);
  const [cSending, setCSending] = React.useState(false);

  const shown = threads.filter((t) => t.channel === channel);

  function compose(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setCSending(true);
    start(async () => {
      const res = await composeEmail({ to: String(fd.get('to') || ''), subject: String(fd.get('subject') || ''), body: String(fd.get('body') || '') });
      setCSending(false);
      if ('error' in res) { toast.error(res.error); return; }
      toast.success('Email sent'); setComposeOpen(false);
    });
  }

  async function open(t: ThreadSummary) {
    setActive(t);
    setMessages([]);
    setReply('');
    setSubject('');
    setLoading(true);
    const res = await loadInboxThread(t.channel, t.key);
    setLoading(false);
    if ('error' in res) { toast.error(res.error); return; }
    setMessages(res.messages);
    if (t.channel === 'EMAIL') {
      const lastSubj = [...res.messages].reverse().find((m) => m.subject)?.subject ?? '';
      setSubject(lastSubj.startsWith('Re:') ? lastSubj : lastSubj ? `Re: ${lastSubj}` : '');
    }
  }

  function send() {
    if (!active || !reply.trim()) return;
    setSending(true);
    start(async () => {
      const res = active.channel === 'EMAIL'
        ? await replyEmailThread({ threadKey: active.key, to: active.replyTo, subject: subject || '(no subject)', body: reply })
        : await replyWhatsappThread({ phone: active.replyTo, body: reply });
      setSending(false);
      if ('error' in res) { toast.error(res.error); return; }
      toast.success('Reply sent');
      const optimistic: ThreadMessage = {
        id: `local-${Date.now()}`, direction: 'OUTBOUND', from: 'You',
        subject: active.channel === 'EMAIL' ? subject : null, body: reply, at: new Date().toISOString(),
      };
      setMessages((m) => [...m, optimistic]);
      setReply('');
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Incoming mail (synced from Gmail) and replies live here — or start a new one.</p>
        <Button size="sm" onClick={() => setComposeOpen(true)} className="gap-1"><Mail className="h-4 w-4" /> New email</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
      {/* Thread list */}
      <div className="rounded-lg border">
        <div className="flex border-b text-sm">
          <button
            onClick={() => { setChannel('EMAIL'); setActive(null); }}
            className={`flex flex-1 items-center justify-center gap-2 py-2.5 font-medium ${channel === 'EMAIL' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
          >
            <Mail className="h-4 w-4" /> Email
          </button>
          <button
            onClick={() => { setChannel('WHATSAPP'); setActive(null); }}
            className={`flex flex-1 items-center justify-center gap-2 py-2.5 font-medium ${channel === 'WHATSAPP' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
          >
            <MessageCircle className="h-4 w-4" /> WhatsApp
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto">
          {shown.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={InboxIcon} title="Nothing here yet" body={channel === 'EMAIL' ? 'Inbound and sent email conversations will appear here.' : 'WhatsApp conversations will appear here.'} />
            </div>
          ) : (
            shown.map((t) => (
              <button
                key={`${t.channel}:${t.key}`}
                onClick={() => open(t)}
                className={`flex w-full flex-col gap-0.5 border-b px-3 py-2.5 text-left hover:bg-muted/50 ${active?.key === t.key && active?.channel === t.channel ? 'bg-muted' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-medium">{t.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(t.lastAt)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs text-muted-foreground">{t.lastSnippet || '—'}</span>
                  {t.unhandled > 0 && (
                    <span className="ml-auto shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{t.unhandled}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Reading + reply pane */}
      <div className="rounded-lg border">
        {!active ? (
          <div className="p-6">
            <EmptyState icon={channel === 'EMAIL' ? Mail : MessageCircle} title="Pick a conversation" body="Choose a conversation on the left to read it and reply." />
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-semibold">{active.title}</div>
                <div className="truncate text-xs text-muted-foreground">{active.subtitle}</div>
              </div>
              {active.partyLink && (
                <Link href={active.partyLink} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  Open record <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>

            <div className="max-h-[48vh] flex-1 space-y-3 overflow-y-auto p-4">
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : messages.length === 0 ? (
                <div className="text-sm text-muted-foreground">No messages in this conversation.</div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.direction === 'OUTBOUND' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      {m.subject && <div className="mb-1 text-xs font-semibold opacity-80">{m.subject}</div>}
                      <div className="whitespace-pre-wrap break-words">{m.body}</div>
                      <div className="mt-1 text-[10px] opacity-70">{new Date(m.at).toLocaleString()}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2 border-t p-3">
              {active.channel === 'EMAIL' && (
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
              )}
              <div className="flex items-end gap-2">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={active.channel === 'EMAIL' ? `Reply to ${active.replyTo}…` : `Message ${active.replyTo} on WhatsApp…`}
                  rows={2}
                  className="flex-1"
                />
                <Button onClick={send} disabled={sending || !reply.trim()} className="gap-1">
                  <Send className="h-4 w-4" /> {sending ? 'Sending…' : 'Send'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      {composeOpen && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-4 pt-[10vh]" role="dialog" aria-modal="true" aria-label="Compose email">
          <div className="w-full max-w-lg rounded-lg border bg-background p-5 shadow-xl">
            <div className="mb-3 flex items-center gap-2"><Mail className="h-5 w-5 text-primary" /><h2 className="font-display text-lg">New email</h2></div>
            <form onSubmit={compose} className="space-y-3">
              <Input name="to" type="email" required placeholder="To (email address)" autoFocus />
              <Input name="subject" placeholder="Subject" />
              <Textarea name="body" required rows={7} placeholder="Write your message…" />
              <p className="text-xs text-muted-foreground">Sends from {`your CRM's email address`} via your existing email setup, and appears in this inbox.</p>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setComposeOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={cSending} className="gap-1"><Send className="h-4 w-4" />{cSending ? 'Sending…' : 'Send email'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
