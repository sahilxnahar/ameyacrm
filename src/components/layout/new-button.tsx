'use client';
import * as React from 'react';
import Link from 'next/link';
import { Plus, UserPlus, CheckSquare, Wallet, FolderPlus, ClipboardCheck, Mic } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface NewItem { label: string; href: string; icon: LucideIcon; permission?: string }

/**
 * "Start anything from anywhere." A single ＋ in the top bar opens the common
 * create actions, so a person three screens deep never has to navigate back to a
 * list just to add a lead or jot a task. Only the actions they are allowed to do
 * are shown.
 */
const ITEMS: NewItem[] = [
  { label: 'New lead', href: '/sales', icon: UserPlus, permission: 'lead.create' },
  { label: 'Log a site visit', href: '/site-visit', icon: ClipboardCheck, permission: 'lead.create' },
  { label: 'New task', href: '/tasks', icon: CheckSquare, permission: 'task.create' },
  { label: 'Record a payment', href: '/payments', icon: Wallet, permission: 'finance.ledger.manage' },
  { label: 'Upload a document', href: '/documents', icon: FolderPlus, permission: 'document.create' },
  { label: 'Voice note', href: '/voice-note', icon: Mic, permission: 'task.create' },
];

export function NewButton({ allowed, isSuperAdmin }: { allowed: Set<string>; isSuperAdmin: boolean }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const canSee = (perm?: string) => !perm || isSuperAdmin || allowed.has('*') || allowed.has(perm);
  const items = ITEMS.filter((i) => canSee(i.permission));

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Create new"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">New</span>
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-56 rounded-lg border bg-popover p-1.5 text-popover-foreground shadow-lg">
          {items.map((i) => {
            const Icon = i.icon;
            return (
              <Link
                key={i.href + i.label}
                href={i.href}
                onClick={() => setOpen(false)}
                className={cn('flex items-center gap-3 rounded-md px-2.5 py-2 text-sm hover:bg-secondary')}
              >
                <Icon className="h-4 w-4 text-[#A07D34]" />
                {i.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
