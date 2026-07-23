'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, IndianRupee, UserPlus, ClipboardCheck, Camera, Mic, X } from 'lucide-react';
import { BottomSheet } from '@/components/ui/bottom-sheet';

interface Action { href: string; label: string; icon: typeof Plus; permission: string | null }
const ACTIONS: Action[] = [
  { href: '/ledgers', label: 'Record a payment', icon: IndianRupee, permission: 'billing.bill.manage' },
  { href: '/sales?new=1', label: 'Add a lead', icon: UserPlus, permission: 'lead.create' },
  { href: '/site-visit', label: 'Log a site visit', icon: ClipboardCheck, permission: 'lead.create' },
  { href: '/site-photos', label: 'Capture a photo', icon: Camera, permission: 'document.create' },
  { href: '/voice-note', label: 'Voice note → task', icon: Mic, permission: 'task.create' },
];

/**
 * The one-thumb "+" on phones. Opens a sheet of the most common things to
 * create from anywhere, so the primary actions are never more than two taps
 * away. Hidden on desktop, and on full-screen flows where it would overlap.
 */
export function MobileFab({ allowed, isSuperAdmin }: { allowed: Set<string>; isSuperAdmin: boolean }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const can = (p: string | null) => !p || isSuperAdmin || allowed.has('*') || allowed.has(p);
  const actions = ACTIONS.filter((a) => can(a.permission));

  // Keep it out of the way of pages that have their own capture UI.
  const hiddenOn = ['/voice-note', '/site-photos', '/chat', '/assistant'];
  if (actions.length === 0 || hiddenOn.some((h) => pathname.startsWith(h))) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Quick actions"
        className="focus-ring fixed right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 lg:hidden"
        style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}
      >
        <Plus className="h-6 w-6" />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Quick actions">
        <div className="grid grid-cols-1 gap-1">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.href}
                href={a.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors active:bg-secondary"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                {a.label}
              </Link>
            );
          })}
        </div>
        <button onClick={() => setOpen(false)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm text-muted-foreground active:bg-secondary">
          <X className="h-4 w-4" /> Close
        </button>
      </BottomSheet>
    </>
  );
}
