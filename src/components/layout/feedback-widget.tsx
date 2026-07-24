'use client';
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquarePlus, X, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { sendFeedback } from '@/server/actions/feedback';
import { cn } from '@/lib/utils/cn';

/**
 * A quiet feedback button on every screen. One line of text (and an optional
 * thumbs up/down) tied to the page they are on — so you finally hear "this
 * screen confused me" instead of guessing. It sits above the mobile bar and out
 * of the way.
 */
export function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [rating, setRating] = React.useState<'up' | 'down' | null>(null);
  const [pending, start] = React.useTransition();

  const submit = () => {
    if (message.trim().length < 3) { toast.error('Tell us a little more.'); return; }
    start(async () => {
      const r = await sendFeedback({ message, rating: rating ?? undefined, path: pathname });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Thank you — we read every note.');
      setMessage(''); setRating(null); setOpen(false);
    });
  };

  return (
    <>
      <button
        type="button"
        aria-label="Send feedback"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-3 z-40 flex h-10 w-10 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-lg transition-colors hover:text-foreground lg:bottom-4 lg:right-4"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed bottom-[calc(8.5rem+env(safe-area-inset-bottom))] right-3 z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border bg-popover p-4 text-popover-foreground shadow-2xl lg:bottom-16 lg:right-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Send feedback</p>
            <button aria-label="Close" onClick={() => setOpen(false)} className="rounded p-0.5 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
          </div>
          <p className="mb-2 text-xs text-muted-foreground">About this screen, or anything at all.</p>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="What worked, what didn't, what you wish it did…"
            className="focus-ring w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="flex gap-1">
              <button aria-label="Thumbs up" onClick={() => setRating((r) => (r === 'up' ? null : 'up'))}
                className={cn('rounded-md border p-1.5', rating === 'up' ? 'border-success text-success' : 'text-muted-foreground hover:bg-secondary')}>
                <ThumbsUp className="h-4 w-4" />
              </button>
              <button aria-label="Thumbs down" onClick={() => setRating((r) => (r === 'down' ? null : 'down'))}
                className={cn('rounded-md border p-1.5', rating === 'down' ? 'border-destructive text-destructive' : 'text-muted-foreground hover:bg-secondary')}>
                <ThumbsDown className="h-4 w-4" />
              </button>
            </div>
            <button onClick={submit} disabled={pending}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-60">
              {pending && <Loader2 className="h-4 w-4 animate-spin" />} Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}
