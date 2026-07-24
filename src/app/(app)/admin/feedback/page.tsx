import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { timeAgo } from '@/lib/utils/format';
import { MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react';

export const metadata: Metadata = { title: 'Feedback' };
export const dynamic = 'force-dynamic';

export default async function FeedbackPage() {
  await requirePermission('admin.setting.manage');
  const rows = await prisma.feedback.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });
  const userIds = [...new Set(rows.map((r) => r.userId).filter((x): x is string => Boolean(x)))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  return (
    <div className="space-y-6">
      <PageHeader title="Feedback" description="What people told us, newest first — tied to the screen they were on. Read it to see where the app still confuses." />
      {rows.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No feedback yet" body="When someone uses the feedback button, their note lands here with the screen they were on." />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm">{r.message}</p>
                {r.rating === 'up' && <ThumbsUp className="h-4 w-4 shrink-0 text-success" />}
                {r.rating === 'down' && <ThumbsDown className="h-4 w-4 shrink-0 text-destructive" />}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{r.userId ? nameById.get(r.userId) ?? 'Someone' : 'Someone'}</span>
                <span>·</span>
                <span>{timeAgo(r.createdAt)}</span>
                {r.path && <Badge variant="secondary" className="font-mono text-[10px]">{r.path}</Badge>}
                {r.handled && <Badge variant="success">Handled</Badge>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
