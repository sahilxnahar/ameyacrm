'use client';
import * as React from 'react';
import Link from 'next/link';
import { Eye, LogOut, Loader2 } from 'lucide-react';
import { logoutAction } from '@/server/actions/auth';

/**
 * A deliberately minimal shell for GUEST / preview accounts. It does NOT render
 * the real app sidebar, top bar, project switcher or any live widget — so a
 * preview visitor never even loads a component that could touch real company
 * data. They see the brand, a clear "preview" banner, and the sample showcase.
 */
export function GuestShell({ name, children }: { name: string; children: React.ReactNode }) {
  const [pending, start] = React.useTransition();
  return (
    <div className="min-h-screen min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/85 px-4 py-2.5 backdrop-blur sm:px-6">
        <Link href="/preview" className="flex shrink-0 items-center gap-2">
          <img src="/brand/mark-gold-light.svg" alt="" className="h-6 w-6 select-none dark:hidden" />
          <img src="/brand/mark-gold-dark.svg" alt="" className="hidden h-6 w-6 select-none dark:block" />
          <span className="text-sm font-semibold tracking-tight">Ameya&nbsp;Heights</span>
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
          <Eye className="h-3.5 w-3.5" /> Product preview
        </span>
        <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">Signed in as {name} · sample data · read-only</span>
        <button
          onClick={() => start(async () => { await logoutAction(); })}
          disabled={pending}
          className="focus-ring inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-secondary"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />} Sign out
        </button>
      </header>

      <div className="border-b bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-700 dark:text-amber-400 sm:px-6">
        You’re viewing a live product preview. Everything here is <strong>sample data</strong> — no real company information is shown, and nothing can be changed.
      </div>

      <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
