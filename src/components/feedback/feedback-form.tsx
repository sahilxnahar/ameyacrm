'use client';
import * as React from 'react';
import { usePathname } from 'next/navigation';
import { ThumbsUp, ThumbsDown, Loader2, Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { sendFeedback } from '@/server/actions/feedback';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

/**
 * The feedback form, now a page of its own reachable from the menu. It used to
 * be a floating button in the corner; that spot belongs to the AI assistant, so
 * feedback moved somewhere calmer where you can take a moment to write more.
 */
export function FeedbackForm() {
  const pathname = usePathname();
  const [message, setMessage] = React.useState('');
  const [rating, setRating] = React.useState<'up' | 'down' | null>(null);
  const [sent, setSent] = React.useState(false);
  const [pending, start] = React.useTransition();

  const submit = () => {
    if (message.trim().length < 3) { toast.error('Tell us a little more.'); return; }
    start(async () => {
      const r = await sendFeedback({ message, rating: rating ?? undefined, path: pathname });
      if ('error' in r) { toast.error(r.error); return; }
      toast.success('Thank you — we read every note.');
      setMessage(''); setRating(null); setSent(true);
    });
  };

  if (sent) {
    return (
      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/10"><CheckCircle2 className="h-6 w-6 text-success" /></span>
        <p className="font-medium">Thank you — your note is with us.</p>
        <p className="max-w-sm text-sm text-muted-foreground">We read every piece of feedback. If you have more to add, you’re welcome to send another.</p>
        <button onClick={() => setSent(false)} className="mt-1 rounded-md border px-4 py-2 text-sm font-medium hover:bg-secondary">Send more feedback</button>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <p className="text-sm font-medium">How is it going?</p>
        <p className="text-sm text-muted-foreground">Tell us what worked, what didn’t, or anything you wish the CRM did. Big or small — it all helps.</p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Overall:</span>
        <button
          type="button"
          aria-label="Thumbs up"
          onClick={() => setRating((r) => (r === 'up' ? null : 'up'))}
          className={cn('flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm', rating === 'up' ? 'border-success text-success' : 'text-muted-foreground hover:bg-secondary')}
        >
          <ThumbsUp className="h-4 w-4" /> Good
        </button>
        <button
          type="button"
          aria-label="Thumbs down"
          onClick={() => setRating((r) => (r === 'down' ? null : 'down'))}
          className={cn('flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm', rating === 'down' ? 'border-destructive text-destructive' : 'text-muted-foreground hover:bg-secondary')}
        >
          <ThumbsDown className="h-4 w-4" /> Could be better
        </button>
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={5}
        placeholder="What worked, what didn’t, what you wish it did…"
        className="focus-ring w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Sent privately to the team. We may follow up if we need more detail.</p>
        <button
          onClick={submit}
          disabled={pending}
          className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send feedback
        </button>
      </div>
    </Card>
  );
}
