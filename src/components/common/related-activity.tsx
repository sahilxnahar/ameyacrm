'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Link2, X, Users2, CheckSquare, Handshake, Receipt, FileText, Building2, Landmark } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { deleteRecordLink } from '@/server/actions/links';
import type { RelatedRecord } from '@/server/services/links-service';
import { cn } from '@/lib/utils/cn';

const ICON: Record<string, LucideIcon> = {
  Lead: Users2, Task: CheckSquare, WorkRequest: Handshake, Voucher: Receipt,
  Document: FileText, Booking: Building2, Unit: Building2, LandParcel: Landmark,
};

/**
 * "Related activity" — everything linked to this record, pulled together in one
 * place. Links are mostly made automatically (raising a work request about a lead
 * links them; accepting one links the task it spawns), and can be tidied here.
 */
export function RelatedActivity({ items, canUnlink = true }: { items: RelatedRecord[]; canUnlink?: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing linked yet. Related records show up here automatically.</p>;
  }

  const unlink = (linkId: string) => start(async () => {
    const r = await deleteRecordLink(linkId);
    if ('error' in r) { toast.error(r.error); return; }
    toast.success('Unlinked.'); router.refresh();
  });

  return (
    <ul className="space-y-1.5">
      {items.map((it) => {
        const Icon = ICON[it.type] ?? Link2;
        const inner = (
          <span className="flex min-w-0 items-center gap-2">
            <Icon className="h-4 w-4 shrink-0 text-[#A07D34]" />
            <span className="min-w-0">
              <span className="block truncate text-sm">{it.label}</span>
              <span className="block text-[11px] text-muted-foreground">{it.typeLabel}{it.kind && it.kind !== 'related' ? ` · ${it.kind}` : ''}</span>
            </span>
          </span>
        );
        return (
          <li key={it.linkId} className={cn('flex items-center justify-between gap-2 rounded-md border p-2')}>
            {it.href ? <Link href={it.href} className="min-w-0 flex-1 hover:underline">{inner}</Link> : <span className="min-w-0 flex-1">{inner}</span>}
            {canUnlink && (
              <button onClick={() => unlink(it.linkId)} disabled={pending} aria-label="Unlink" className="shrink-0 rounded p-1 text-muted-foreground hover:bg-secondary hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
