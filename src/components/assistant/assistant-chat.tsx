'use client';
import * as React from 'react';
import { Send, Loader2, Bot, User, Sparkles } from 'lucide-react';
import { askAssistant, type AssistantTurn } from '@/server/actions/assistant';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

const SUGGESTIONS = [
  'Draft a polite follow-up to a buyer who has gone quiet.',
  'Explain what RERA escrow means in one line.',
  'Summarise this: ',
  'What should I do first with a new hot lead?',
];

export function AssistantChat({ configured }: { configured: boolean }) {
  const [turns, setTurns] = React.useState<AssistantTurn[]>([]);
  const [input, setInput] = React.useState('');
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [turns, pending]);

  const send = (text: string) => {
    const content = text.trim();
    if (!content || pending) return;
    setError(null);
    const next: AssistantTurn[] = [...turns, { role: 'user', content }];
    setTurns(next);
    setInput('');
    start(async () => {
      const r = await askAssistant(next);
      if ('error' in r && !r.ok) {
        setError(r.error);
        return;
      }
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
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">Draft a message, explain a term, summarise something you paste, or think through a next step.</p>
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
          <div ref={endRef} />
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-end gap-2 border-t p-3"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            rows={1}
            placeholder="Ask anything… (Shift+Enter for a new line)"
            className="focus-ring max-h-32 min-h-[40px] flex-1 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <button type="submit" disabled={pending || !input.trim()} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
      </Card>
      <p className="text-center text-xs text-muted-foreground">The assistant can be wrong. It has no live access to your data — paste details for specific records.</p>
    </div>
  );
}
