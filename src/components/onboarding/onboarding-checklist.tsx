'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ChevronRight, X, Loader2 } from 'lucide-react';
import { completeStep, dismissOnboarding } from '@/server/actions/onboarding';
import type { Step } from '@/config/onboarding';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

export function OnboardingChecklist({ steps, doneKeys }: { steps: Step[]; doneKeys: string[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const done = new Set(doneKeys);
  const remaining = steps.filter((s) => !done.has(s.key));
  if (remaining.length === 0) return null;

  const pct = Math.round(((steps.length - remaining.length) / steps.length) * 100);

  return (
    <Card className="mb-5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold">Getting started</p>
          <p className="text-sm text-muted-foreground">{remaining.length} left · takes about ten minutes in total</p>
        </div>
        <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs" disabled={pending}
          title="Hide this for good" onClick={() => start(async () => { await dismissOnboarding(); router.refresh(); })}>
          <X className="h-3.5 w-3.5" /> Dismiss
        </Button>
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="mt-3 space-y-1.5">
        {steps.map((s) => {
          const isDone = done.has(s.key);
          return (
            <li key={s.key} className={cn('flex items-start gap-2.5 rounded-md p-2', isDone && 'opacity-50')}>
              <button
                disabled={pending || isDone}
                title={isDone ? 'Done' : 'Mark this as done'}
                onClick={() => start(async () => { await completeStep(s.key); router.refresh(); })}
                className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                  isDone ? 'border-success bg-success text-white' : 'hover:border-primary')}
              >
                {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : isDone ? <Check className="h-3 w-3" /> : null}
              </button>
              <span className="min-w-0 flex-1">
                <span className={cn('block text-sm font-medium', isDone && 'line-through')}>{s.title}</span>
                <span className="block text-xs text-muted-foreground">{s.body}</span>
              </span>
              {!isDone && (
                <Link href={s.href} className="mt-0.5 flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary">
                  Go <ChevronRight className="h-3 w-3" />
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
