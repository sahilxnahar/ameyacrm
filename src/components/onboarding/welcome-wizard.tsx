'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Users2, Wallet, HardHat, Megaphone, Shield, ArrowRight, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { completeStep } from '@/server/actions/onboarding';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface Role { key: string; label: string; blurb: string; href: string; icon: LucideIcon }

/**
 * The very first thing a new person sees. Instead of dropping them into a
 * powerful, unfamiliar app, it asks one question — what do you do — and takes
 * them straight to the screen that matters for that job. Shown once (we tick a
 * hidden `welcome` step), and only to genuinely new users.
 */
const ROLES: Role[] = [
  { key: 'sales', label: 'Sales & leads', blurb: 'Enquiries, follow-ups, bookings.', href: '/sales', icon: Users2 },
  { key: 'finance', label: 'Money & accounts', blurb: 'Bills, payments, collections.', href: '/billing', icon: Wallet },
  { key: 'site', label: 'Site & construction', blurb: 'Progress, materials, quality.', href: '/field', icon: HardHat },
  { key: 'marketing', label: 'Marketing', blurb: 'Campaigns and the website.', href: '/marketing', icon: Megaphone },
  { key: 'owner', label: 'Owner / manager', blurb: 'The whole picture at a glance.', href: '/dashboard', icon: Shield },
];

export function WelcomeWizard({ name }: { name: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [open, setOpen] = React.useState(true);
  const firstName = name.split(' ')[0] || 'there';

  const finish = (href?: string) =>
    start(async () => {
      await completeStep('welcome');
      setOpen(false);
      if (href) router.push(href);
      router.refresh();
    });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold">Welcome, {firstName} 👋</h2>
            <p className="mt-1 text-sm text-muted-foreground">To get you to the right place fast — what do you mostly do here?</p>
          </div>
          <button onClick={() => finish()} disabled={pending} aria-label="Skip" className="rounded-md p-1 text-muted-foreground hover:bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {ROLES.map((r) => {
            const Icon = r.icon;
            return (
              <button
                key={r.key}
                onClick={() => finish(r.href)}
                disabled={pending}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-60',
                )}
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <Icon className="h-4 w-4 text-[#A07D34]" />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1 font-medium">{r.label} <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" /></span>
                  <span className="block text-xs text-muted-foreground">{r.blurb}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">You can change everything later. The menu adapts to what you use.</p>
          <Button variant="ghost" size="sm" onClick={() => finish()} disabled={pending}>Skip for now</Button>
        </div>
      </div>
    </div>
  );
}
