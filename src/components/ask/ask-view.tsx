'use client';
import * as React from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Loader2, Search, RefreshCw, FileText, Sparkles } from 'lucide-react';
import { ask, indexAllDocuments } from '@/server/actions/docqa';
import type { Answer } from '@/server/services/docqa-service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

const EXAMPLES = [
  'What is the penalty clause for delayed possession?',
  'What is the maintenance charge and how is it calculated?',
  'Which documents does a buyer need for registration?',
  'What is the payment schedule after the foundation stage?',
];

export function AskView({ indexedChunks, indexedTitles, canIndex }: { indexedChunks: number; indexedTitles: string[]; canIndex: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [q, setQ] = React.useState('');
  const [res, setRes] = React.useState<Answer | null>(null);

  const run = (question: string) => {
    if (!question.trim()) return;
    setQ(question);
    start(async () => {
      const r = await ask(question);
      if ('error' in r) return toast.error(r.error);
      setRes(r.data);
    });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <form onSubmit={(e) => { e.preventDefault(); run(q); }} className="flex flex-wrap gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} className="min-w-52 flex-1"
            placeholder="What is the penalty clause in the Basaveshwar agreement?" />
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Ask
          </Button>
          {canIndex && (
            <Button type="button" variant="outline" disabled={pending}
              title="Read every document again and make it searchable"
              onClick={() => start(async () => {
                const r = await indexAllDocuments();
                if ('error' in r) return toast.error(r.error);
                toast.success(r.message, { duration: 8000 });
                router.refresh();
              })}>
              <RefreshCw className="h-4 w-4" /> Index documents
            </Button>
          )}
        </form>

        <div className="chip-row mt-3">
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => run(e)} disabled={pending}
              className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary">
              {e}
            </button>
          ))}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          {indexedChunks === 0
            ? 'Nothing is indexed yet. Press “Index documents” to make your uploads searchable.'
            : `${indexedChunks} passages searchable across ${indexedTitles.length} documents.`}
        </p>
      </Card>

      {res && (
        <>
          <Card className="p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Answer</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{res.answer}</p>
          </Card>

          {res.sources.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Where this came from</p>
              <div className="space-y-2">
                {res.sources.map((s, i) => (
                  <Card key={i} className="p-3">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="min-w-0 truncate">[{i + 1}] {s.title}</span>
                      <Badge variant="secondary" className="ml-auto shrink-0 text-[10px]">{s.score}% match</Badge>
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.snippet}…</p>
                  </Card>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Always read the passage yourself before relying on it for anything contractual.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
