'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { RotateCcw } from 'lucide-react';
import { sandboxReset } from '@/server/actions/sandbox';

/** Rupee formatting, Indian grouping. */
export const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
export const crore = (n: number) => (n >= 10000000 ? `₹${(n / 10000000).toFixed(2)} Cr` : inr(n));

export type Runner = (fn: () => Promise<{ ok: true } | { error: string }>, okMsg: string) => void;

/** Shared action runner: one place that reports failures rather than swallowing them. */
export function useRunner(): [boolean, Runner] {
  const [pending, start] = React.useTransition();
  const run: Runner = (fn, okMsg) =>
    start(async () => {
      const r = await fn();
      if ('error' in r) { toast.error(r.error); return; }
      toast.success(okMsg);
    });
  return [pending, run];
}

export function PageHead({ title, blurb, children }: { title: string; blurb: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 toolbar items-start gap-3">
      <div>
        <h1 className="font-display text-2xl tracking-tight">{title}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{blurb}</p>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function ResetButton() {
  const [pending, run] = useRunner();
  return (
    <button
      type="button" disabled={pending}
      onClick={() => {
        if (!window.confirm('Put the demo workspace back to how it started? Anything you added will be removed.')) return;
        run(sandboxReset, 'Demo workspace reset');
      }}
      className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-50"
    >
      <RotateCcw className="h-3.5 w-3.5" /> Reset demo
    </button>
  );
}

export function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card-elevated rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div>;
}
