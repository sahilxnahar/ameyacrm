'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, X, Inbox, Loader2 } from 'lucide-react';
import { decideApprovalStep } from '@/server/actions/approvals';
import type { ApprovalItem } from '@/server/services/approvals-service';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { timeAgo, titleCase } from '@/lib/utils/format';

export function ApprovalsInbox({ items }: { items: ApprovalItem[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [comments, setComments] = React.useState<Record<string, string>>({});

  const decide = (stepId: string, decision: 'APPROVED' | 'REJECTED') =>
    start(async () => { const r = await decideApprovalStep(stepId, decision, comments[stepId]); if ('error' in r) { toast.error(r.error); return; } toast.success(`Marked ${decision.toLowerCase()}`); router.refresh(); });

  if (items.length === 0) return (
    <Card className="flex flex-col items-center gap-2 p-12 text-center text-muted-foreground">
      <Inbox className="h-8 w-8" /><p className="text-sm">You’re all caught up — no approvals waiting.</p>
    </Card>
  );

  return (
    <div className="space-y-3">
      {items.map((it) => (
        <Card key={it.stepId} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="outline">{titleCase(it.entityType)}</Badge>
                {it.reference && <span className="font-mono text-xs text-muted-foreground">{it.reference}</span>}
              </div>
              <Link href={it.href} className="font-medium hover:text-primary">{it.title}</Link>
              <p className="text-xs text-muted-foreground">Requested by {it.requester} · {timeAgo(it.createdAt)}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button size="sm" disabled={pending} onClick={() => decide(it.stepId, 'APPROVED')}><Check className="h-4 w-4" /> Approve</Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => decide(it.stepId, 'REJECTED')}><X className="h-4 w-4" /> Reject</Button>
            </div>
          </div>
          <Input className="mt-3" placeholder="Optional comment…" value={comments[it.stepId] ?? ''} onChange={(e) => setComments((p) => ({ ...p, [it.stepId]: e.target.value }))} />
        </Card>
      ))}
      {pending && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Working…</p>}
    </div>
  );
}
