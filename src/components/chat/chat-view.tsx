'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Send, Loader2, Plus, X, Search, MessagesSquare, AtSign, Check, Pencil, Paperclip, FileText } from 'lucide-react';
import { upload } from '@vercel/blob/client';
import { sendMessage, startDirectConversation, fetchMessages, setMyUsername, markConversationRead } from '@/server/actions/chat';
import type { ConversationSummary, DirectoryUser, ChatMessageRow } from '@/server/services/chat-service';
import { segmentMessage } from '@/lib/chat/mentions';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import { timeAgo, formatDateTime } from '@/lib/utils/format';
import { useVisiblePoll } from '@/lib/hooks/use-visible-poll';

function MessageBody({ body, meHandle }: { body: string; meHandle: string | null }) {
  return (
    <>
      {segmentMessage(body).map((seg, i) =>
        seg.type === 'text' ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <span key={i} className={cn('rounded px-1 font-medium', meHandle && seg.handle.toLowerCase() === meHandle.toLowerCase() ? 'bg-primary/25 text-primary' : 'bg-primary/10 text-primary')}>
            @{seg.handle}
          </span>
        ),
      )}
    </>
  );
}

export function ChatView({
  me, conversations, directory, activeId, activeTitle, activeMessages,
}: {
  me: { id: string; name: string; username: string | null };
  conversations: ConversationSummary[];
  directory: DirectoryUser[];
  activeId: string | null;
  activeTitle: string | null;
  activeMessages: ChatMessageRow[];
}) {
  const router = useRouter();
  const [messages, setMessages] = React.useState<ChatMessageRow[]>(activeMessages);
  const [input, setInput] = React.useState('');
  const [pending, start] = React.useTransition();
  const [picker, setPicker] = React.useState(false);
  const [dirQuery, setDirQuery] = React.useState('');
  const [editingName, setEditingName] = React.useState(false);
  const [files, setFiles] = React.useState<{ url: string; name: string; mimeType: string; preview?: string }[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => setMessages(activeMessages), [activeMessages, activeId]);
  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Mark the open conversation read once when it changes.
  React.useEffect(() => { if (activeId) void markConversationRead(activeId); }, [activeId]);

  // Poll for new messages while a conversation is open — but only while the tab
  // is visible, so a chat left open in a background tab stops polling until you
  // come back to it (no socket server needed).
  useVisiblePoll(() => {
    if (!activeId) return;
    void fetchMessages(activeId).then((r) => { if ('ok' in r && r.ok) setMessages(r.messages); });
  }, 6000, [activeId]);

  const open = (id: string) => router.push(`/chat?c=${id}`);

  // Upload files (a screenshot of a forwarded email, a PDF, anything) to blob so
  // they can ride along with a message.
  const uploadFiles = async (list: File[]) => {
    const ok: typeof files = [];
    setUploading(true);
    for (const f of list.slice(0, 5)) {
      try {
        const blob = await upload(f.name, f, { access: 'public', handleUploadUrl: '/api/upload' });
        ok.push({ url: blob.url, name: f.name, mimeType: f.type || 'application/octet-stream', preview: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined });
      } catch { toast.error(`Could not attach ${f.name}`); }
    }
    setUploading(false);
    if (ok.length) setFiles((prev) => [...prev, ...ok]);
  };

  const send = () => {
    const text = input.trim();
    if ((!text && files.length === 0) || !activeId || pending || uploading) return;
    const sending = files;
    setInput(''); setFiles([]);
    setMessages((prev) => [...prev, { id: `tmp-${prev.length}`, senderId: me.id, senderName: me.name, body: text, createdAt: new Date(), mine: true, attachments: sending.map((f, i) => ({ id: `t${i}`, url: f.url, name: f.name, mimeType: f.mimeType })) }]);
    start(async () => {
      const r = await sendMessage(activeId, text, sending.map((f) => ({ url: f.url, name: f.name, mimeType: f.mimeType })));
      if ('error' in r) { toast.error(r.error); return; }
      const fresh = await fetchMessages(activeId);
      if ('ok' in fresh && fresh.ok) setMessages(fresh.messages);
    });
  };

  const startWith = (userId: string) => start(async () => {
    const r = await startDirectConversation(userId);
    if ('error' in r) { toast.error(r.error); return; }
    setPicker(false); setDirQuery('');
    if (r.conversationId) router.push(`/chat?c=${r.conversationId}`);
  });

  // Simple @autocomplete: when the word being typed starts with @, suggest people.
  const atMatch = /(?:^|\s)@([a-zA-Z0-9._-]*)$/.exec(input);
  const suggestions = atMatch
    ? directory.filter((u) => u.username && u.username.toLowerCase().startsWith((atMatch[1] ?? '').toLowerCase())).slice(0, 5)
    : [];
  const applySuggestion = (username: string) => {
    setInput((prev) => prev.replace(/@([a-zA-Z0-9._-]*)$/, `@${username} `));
    taRef.current?.focus();
  };

  const dir = dirQuery.trim()
    ? directory.filter((u) => u.name.toLowerCase().includes(dirQuery.toLowerCase()) || (u.username ?? '').toLowerCase().includes(dirQuery.toLowerCase()))
    : directory;

  return (
    <div className="grid h-[calc(100vh-13rem)] grid-cols-1 gap-4 lg:grid-cols-[20rem_1fr]">
      {/* Left: username + conversations */}
      <Card className={cn('flex flex-col overflow-hidden p-0', activeId && 'hidden lg:flex')}>
        <div className="border-b p-3">
          <UsernameRow me={me} editing={editingName} setEditing={setEditingName} onSaved={() => router.refresh()} />
          <button onClick={() => setPicker(true)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
            <Plus className="h-4 w-4" /> New message
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No conversations yet. Start one with anyone in the company.</p>
          ) : conversations.map((c) => (
            <button key={c.id} onClick={() => open(c.id)} className={cn('flex w-full items-center gap-2 border-b px-3 py-2.5 text-left hover:bg-secondary/50', c.id === activeId && 'bg-secondary')}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full brass-gradient text-xs font-semibold text-white">{c.title.slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-1">
                  <span className="truncate text-sm font-medium">{c.title}</span>
                  {c.lastAt && <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(c.lastAt)}</span>}
                </span>
                <span className="truncate text-xs text-muted-foreground">{c.lastMessage ?? 'No messages yet'}</span>
              </span>
              {c.unread > 0 && <span className="shrink-0 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{c.unread}</span>}
            </button>
          ))}
        </div>
      </Card>

      {/* Right: active thread */}
      <Card className={cn('flex flex-col overflow-hidden p-0', !activeId && 'hidden lg:flex')}>
        {!activeId ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <MessagesSquare className="mb-2 h-8 w-8" />
            <p className="text-sm">Pick a conversation, or start a new message.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b p-3">
              <button onClick={() => router.push('/chat')} className="lg:hidden"><X className="h-4 w-4" /></button>
              <span className="font-medium">{activeTitle ?? 'Conversation'}</span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && <p className="text-center text-sm text-muted-foreground">No messages yet — say hello.</p>}
              {messages.map((m) => (
                <div key={m.id} className={cn('flex flex-col', m.mine ? 'items-end' : 'items-start')}>
                  {!m.mine && <span className="mb-0.5 text-[11px] text-muted-foreground">{m.senderName}</span>}
                  <div className={cn('max-w-[80%] space-y-2 rounded-2xl px-3 py-2 text-sm', m.mine ? 'bg-primary text-primary-foreground' : 'bg-secondary')}>
                    {m.body && <div className="whitespace-pre-wrap"><MessageBody body={m.body} meHandle={me.username} /></div>}
                    {m.attachments.map((a) => (
                      a.mimeType?.startsWith('image/') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <a key={a.id} href={a.url} target="_blank" rel="noreferrer"><img src={a.url} alt={a.name} className="max-h-56 rounded-lg" /></a>
                      ) : (
                        <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className={cn('flex items-center gap-1.5 rounded-md px-2 py-1 text-xs underline', m.mine ? 'bg-primary-foreground/15' : 'bg-background')}><FileText className="h-3.5 w-3.5" /> {a.name}</a>
                      )
                    ))}
                  </div>
                  <span className="mt-0.5 text-[10px] text-muted-foreground">{formatDateTime(m.createdAt)}</span>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <div className="relative border-t p-3">
              {suggestions.length > 0 && (
                <div className="absolute bottom-full left-3 mb-1 w-56 overflow-hidden rounded-lg border bg-popover shadow-lg">
                  {suggestions.map((u) => (
                    <button key={u.id} onClick={() => applySuggestion(u.username)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary">
                      <AtSign className="h-3.5 w-3.5 text-[#A07D34]" /> <span className="font-medium">{u.username}</span> <span className="truncate text-xs text-muted-foreground">{u.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {files.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <span key={i} className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs">
                      {f.preview ? <img src={f.preview} alt="" className="h-5 w-5 rounded object-cover" /> : <FileText className="h-3.5 w-3.5" />}
                      <span className="max-w-[8rem] truncate">{f.name}</span>
                      <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { void uploadFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading} title="Attach a file or a screenshot of an email" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border hover:bg-secondary disabled:opacity-50">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </button>
                <textarea
                  ref={taRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onPaste={(e) => { const f = Array.from(e.clipboardData?.files ?? []); if (f.length) { e.preventDefault(); void uploadFiles(f); } }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && suggestions.length === 0) { e.preventDefault(); send(); } }}
                  rows={1}
                  placeholder="Message, @tag someone, or paste a screenshot of an email"
                  className="focus-ring max-h-32 min-h-[40px] flex-1 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <button onClick={send} disabled={pending || uploading || (!input.trim() && files.length === 0)} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* New-message picker */}
      {picker && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24" onClick={() => setPicker(false)}>
          <Card className="w-full max-w-md p-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold">Message someone</p><button onClick={() => setPicker(false)}><X className="h-4 w-4" /></button></div>
            <div className="relative mb-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input autoFocus value={dirQuery} onChange={(e) => setDirQuery(e.target.value)} placeholder="Search by name or @username" className="pl-9" /></div>
            <div className="max-h-72 overflow-y-auto">
              {dir.length === 0 ? <p className="p-3 text-sm text-muted-foreground">No one matches.</p> : dir.map((u) => (
                <button key={u.id} onClick={() => startWith(u.id)} disabled={pending} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-secondary">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full brass-gradient text-xs font-semibold text-white">{u.name.slice(0, 2).toUpperCase()}</span>
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{u.name}</span><span className="block truncate text-xs text-muted-foreground">@{u.username}</span></span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function UsernameRow({ me, editing, setEditing, onSaved }: { me: { username: string | null }; editing: boolean; setEditing: (v: boolean) => void; onSaved: () => void }) {
  const [value, setValue] = React.useState(me.username ?? '');
  const [pending, start] = React.useTransition();
  const save = () => start(async () => {
    const r = await setMyUsername(value);
    if ('error' in r) { toast.error(r.error); return; }
    toast.success('Username saved'); setEditing(false); onSaved();
  });
  if (!editing) {
    return (
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Your handle: <span className="font-medium text-foreground">@{me.username ?? 'not set'}</span></span>
        <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"><Pencil className="h-3 w-3" /> Edit</button>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="username" className="h-8 text-sm" />
      <button onClick={save} disabled={pending} className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">{pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-4 w-4" />}</button>
    </div>
  );
}
