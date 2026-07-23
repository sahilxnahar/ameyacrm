'use client';
import * as React from 'react';
import { Send, Loader2, Bot, User, Sparkles, Paperclip, X, FolderInput, FileText, Search, CheckCircle2, Library } from 'lucide-react';
import Link from 'next/link';
import { askAssistant, type AssistantTurn } from '@/server/actions/assistant';
import { askAssistantAboutFile, listFilingFolders, fileAssistantDocument, type FilingFolder } from '@/server/actions/assistant-files';
import { ask } from '@/server/actions/docqa';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

const SUGGESTIONS = [
  'Draft a polite follow-up to a buyer who has gone quiet.',
  'Explain what RERA escrow means in one line.',
  'Summarise this: ',
  'What should I do first with a new hot lead?',
];

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,image/*,application/pdf';
const MAX_BYTES = 10 * 1024 * 1024;

/** After a file is read, we offer to file it. This carries what we need. */
type Filing = { file: File; title: string };

export function AssistantChat({ configured }: { configured: boolean }) {
  const [turns, setTurns] = React.useState<AssistantTurn[]>([]);
  const [input, setInput] = React.useState('');
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [attached, setAttached] = React.useState<File | null>(null);
  const [filing, setFiling] = React.useState<Filing | null>(null);
  const [grounded, setGrounded] = React.useState(false);
  const endRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turns, pending, filing]);

  const pickFile = (f: File | null) => {
    if (!f) return;
    if (f.size > MAX_BYTES) { setError('That file is over 10MB. Please attach a smaller one.'); return; }
    setError(null);
    setAttached(f);
  };

  const send = (text: string) => {
    const content = text.trim();
    if (pending) return;

    // With a file attached, ask about the document.
    if (attached) {
      const file = attached;
      const question = content;
      const label = question ? `📎 ${file.name}\n\n${question}` : `📎 ${file.name}`;
      const next: AssistantTurn[] = [...turns, { role: 'user', content: label }];
      setTurns(next);
      setInput('');
      setAttached(null);
      setError(null);
      setFiling(null);
      start(async () => {
        const fd = new FormData();
        fd.set('file', file);
        fd.set('question', question);
        const r = await askAssistantAboutFile(fd);
        if (!r.ok) { setError(r.error); return; }
        setTurns((prev) => [
          ...prev,
          { role: 'assistant', content: r.text },
          { role: 'assistant', content: `Would you like me to file "${file.name}" away? Tell me where it should go.` },
        ]);
        setFiling({ file, title: file.name });
      });
      return;
    }

    // Plain text question.
    if (!content) return;
    setError(null);
    const next: AssistantTurn[] = [...turns, { role: 'user', content }];
    setTurns(next);
    setInput('');

    // Grounded mode: answer from your indexed documents (RAG), with sources.
    if (grounded) {
      start(async () => {
        const r = await ask(content);
        if ('error' in r) { setError(r.error); return; }
        const src = r.data.sources.slice(0, 4).map((s) => s.title).filter((v, i, a) => a.indexOf(v) === i);
        const footer = src.length ? `\n\n— From your documents: ${src.join(', ')}` : '';
        setTurns((prev) => [...prev, { role: 'assistant', content: r.data.answer + footer }]);
      });
      return;
    }

    start(async () => {
      const r = await askAssistant(next);
      if ('error' in r && !r.ok) { setError(r.error); return; }
      setTurns((prev) => [...prev, { role: 'assistant', content: r.text }]);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {!configured && (
        <Card className="border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          The assistant isn’t switched on yet. Add an AI key in Vercel (<code className="rounded bg-secondary px-1">AI_API_KEY</code> for OpenRouter,
          or <code className="rounded bg-secondary px-1">GEMINI_API_KEY</code>) and redeploy. You can still open it — it just can’t answer until a key is set.
        </Card>
      )}

      <Card className="flex min-h-[420px] flex-col p-0">
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {turns.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><Sparkles className="h-6 w-6 text-[#A07D34]" /></span>
              <p className="font-medium">How can I help?</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">Draft a message, explain a term, summarise something you paste, or attach a document and ask about it.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => setInput(s)} className="rounded-full border px-3 py-1.5 text-xs hover:bg-secondary">{s.length > 40 ? s.slice(0, 40) + '…' : s}</button>
                ))}
              </div>
            </div>
          ) : (
            turns.map((t, i) => (
              <div key={i} className={cn('flex gap-2.5', t.role === 'user' ? 'flex-row-reverse' : '')}>
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', t.role === 'user' ? 'bg-secondary' : 'bg-primary/10')}>
                  {t.role === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5 text-[#A07D34]" />}
                </span>
                <div className={cn('max-w-[80%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm', t.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary')}>
                  {t.content}
                </div>
              </div>
            ))
          )}
          {pending && (
            <div className="flex gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10"><Bot className="h-3.5 w-3.5 text-[#A07D34]" /></span>
              <div className="rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {filing && !pending && <FilingPicker filing={filing} onDone={() => setFiling(null)} />}
          <div ref={endRef} />
        </div>

        {/* Attached-file chip */}
        {attached && (
          <div className="mx-3 mt-2 flex items-center gap-2 rounded-md border bg-secondary/60 px-2.5 py-1.5 text-xs">
            <FileText className="h-3.5 w-3.5 shrink-0 text-[#A07D34]" />
            <span className="min-w-0 flex-1 truncate">{attached.name}</span>
            <span className="shrink-0 text-muted-foreground">{(attached.size / 1024).toFixed(0)} KB</span>
            <button aria-label="Remove attachment" onClick={() => setAttached(null)} className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-end gap-2 border-t p-3"
        >
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => { pickFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
          />
          <button
            type="button"
            onClick={() => setGrounded((v) => !v)}
            aria-pressed={grounded}
            title={grounded ? 'Answering from your indexed documents — click to switch off' : 'Answer from your documents (searches your indexed files)'}
            className={cn('focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border', grounded ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground')}
          >
            <Library className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Attach a document"
            title="Attach a PDF or image"
            className="focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={1}
            placeholder={attached ? 'Ask about this document… (or leave blank for a summary)' : grounded ? 'Ask about your documents — answers cite your files…' : 'Ask anything… (Shift+Enter for a new line)'}
            className="focus-ring max-h-32 min-h-[40px] flex-1 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button type="submit" disabled={pending || (!input.trim() && !attached)} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </Card>
      <p className="text-center text-xs text-muted-foreground">The assistant can be wrong. It has no live access to your data — paste details for specific records.</p>
    </div>
  );
}

/**
 * The "where should this go?" step. Lists the folders you can open; picking one
 * files the document there through the normal upload path.
 */
function FilingPicker({ filing, onDone }: { filing: Filing; onDone: () => void }) {
  const [folders, setFolders] = React.useState<FilingFolder[] | null>(null);
  const [query, setQuery] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [filedTo, setFiledTo] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    listFilingFolders().then((r) => { if (live) setFolders(r.folders); }).catch(() => { if (live) setFolders([]); });
    return () => { live = false; };
  }, []);

  const fileInto = (folder: FilingFolder) => {
    if (busy) return;
    setBusy(folder.id);
    setErr(null);
    const fd = new FormData();
    fd.set('file', filing.file);
    fd.set('folderId', folder.id);
    fd.set('title', filing.title);
    fileAssistantDocument(fd)
      .then((r) => {
        if (!r.ok) { setErr(r.error); setBusy(null); return; }
        setFiledTo(folder.name);
      })
      .catch(() => { setErr('That didn’t go through. Please try again.'); setBusy(null); });
  };

  if (filedTo) {
    return (
      <div className="ml-9 flex items-center gap-2 rounded-lg border border-success/40 bg-success/5 px-3 py-2 text-sm">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
        <span>Filed <span className="font-medium">{filing.title}</span> into <span className="font-medium">{filedTo}</span>.</span>
        <Link href="/documents" className="ml-auto shrink-0 font-medium text-primary hover:underline">Open Documents</Link>
      </div>
    );
  }

  const list = (folders ?? []).filter((f) => f.name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div className="ml-9 rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-medium"><FolderInput className="h-4 w-4 text-[#A07D34]" /> File this document</div>
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a folder — e.g. Legal, Bills…"
          className="focus-ring w-full rounded-md border border-input bg-background py-1.5 pl-8 pr-2 text-sm"
        />
      </div>
      {folders === null ? (
        <p className="px-1 py-2 text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> Loading your folders…</p>
      ) : list.length === 0 ? (
        <p className="px-1 py-2 text-xs text-muted-foreground">{query ? 'No matching folder.' : 'No folders yet — create one in Documents first.'}</p>
      ) : (
        <div className="max-h-44 space-y-0.5 overflow-y-auto">
          {list.map((f) => (
            <button
              key={f.id}
              onClick={() => fileInto(f)}
              disabled={!!busy}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary disabled:opacity-60"
              style={{ paddingLeft: `${0.5 + Math.min(f.depth, 5) * 0.75}rem` }}
            >
              {busy === f.id ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <FolderInput className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              <span className="truncate">{f.name}</span>
            </button>
          ))}
        </div>
      )}
      {err && <p className="mt-1.5 text-xs text-destructive">{err}</p>}
      <button onClick={onDone} className="mt-2 text-xs text-muted-foreground hover:text-foreground">No thanks, don’t file it</button>
    </div>
  );
}
