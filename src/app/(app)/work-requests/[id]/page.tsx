import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { getWorkRequest, userDeptIds } from '@/server/services/workrequest-service';
import { WorkRequestDetailPanel } from '@/components/workrequests/work-request-detail-panel';
import { wrStatusLabel, type WRSide } from '@/lib/workrequests/lifecycle';
import { formatDate, timeAgo } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Work Request' };
export const dynamic = 'force-dynamic';

export default async function WorkRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission('workrequest.view');
  const { id } = await params;
  const wr = await getWorkRequest(id);
  if (!wr) notFound();

  const myDepts = await userDeptIds(ctx.user.id);
  // Work out the viewer's side from the raw dept ids on the record.
  const raw = await prisma.workRequest.findUnique({ where: { id }, select: { fromDeptId: true, toDeptId: true, raisedById: true } });
  const side: WRSide | null = raw && raw.toDeptId && myDepts.includes(raw.toDeptId)
    ? 'receiver'
    : raw && (raw.raisedById === ctx.user.id || (raw.fromDeptId != null && myDepts.includes(raw.fromDeptId)))
      ? 'raiser'
      : null;
  const canAct = side === 'raiser' || (side === 'receiver' && can(ctx.permissions, 'workrequest.manage'));

  return (
    <div className="space-y-6">
      <Link href="/work-requests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All work requests</Link>
      <PageHeader title={wr.title} description={`${wr.reference} · ${wr.fromDept ?? 'Someone'} → ${wr.toDept ?? 'a team'}`}>
        <StatusBadge status={wr.status} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {wr.detail && <Card className="p-4"><p className="whitespace-pre-wrap text-sm">{wr.detail}</p></Card>}

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">History</h3>
            <ol className="space-y-3">
              {wr.events.map((e) => (
                <li key={e.id} className="flex gap-3 text-sm">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p>{e.fromStatus ? `${wrStatusLabel(e.fromStatus)} → ` : ''}<span className="font-medium">{wrStatusLabel(e.toStatus)}</span>{e.actor ? ` by ${e.actor}` : ''}</p>
                    {e.note && <p className="text-xs text-muted-foreground">{e.note}</p>}
                    <p className="text-xs text-muted-foreground">{timeAgo(e.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Comments</h3>
            {wr.comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            ) : (
              <ul className="mb-4 space-y-3">
                {wr.comments.map((c) => (
                  <li key={c.id} className="text-sm">
                    <p className="whitespace-pre-wrap">{c.body}</p>
                    <p className="text-xs text-muted-foreground">{c.author ?? 'Someone'} · {timeAgo(c.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
            <WorkRequestDetailPanel id={wr.id} status={wr.status} side={side} canAct={canAct} />
          </Card>
        </div>

        <div className="space-y-3">
          <Card className="p-4 text-sm">
            <dl className="space-y-2">
              <div><dt className="text-xs text-muted-foreground">Priority</dt><dd>{wr.priority.toLowerCase()}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Owner</dt><dd>{wr.owner ?? 'Unassigned'}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Raised by</dt><dd>{wr.raisedBy ?? 'Someone'}</dd></div>
              {wr.dueOn && <div><dt className="text-xs text-muted-foreground">Needed by</dt><dd>{formatDate(wr.dueOn)}</dd></div>}
              {wr.linkedTaskId && <div><dt className="text-xs text-muted-foreground">Task</dt><dd><Link className="text-primary hover:underline" href={`/tasks/${wr.linkedTaskId}`}>Open linked task</Link></dd></div>}
              {wr.entityType && wr.entityId && <div><dt className="text-xs text-muted-foreground">About</dt><dd>{wr.entityType}</dd></div>}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
