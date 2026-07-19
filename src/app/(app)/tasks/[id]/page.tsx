import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { CalendarDays, Clock, Building2, FolderKanban } from 'lucide-react';
import { requirePermission } from '@/lib/auth/current-user';
import { getTaskDetail } from '@/server/services/task-service';
import { prisma } from '@/lib/db/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PriorityBadge, StatusBadge, AssigneeStateBadge } from '@/components/tasks/badges';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { AssignmentActions } from '@/components/tasks/assignment-actions';
import { TaskChecklist } from '@/components/tasks/task-checklist';
import { TaskComments } from '@/components/tasks/task-comments';
import { TaskManagePanel } from '@/components/tasks/task-manage-panel';
import { formatDate, initials, timeAgo, titleCase } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Task' };

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePermission('task.view');
  const { id } = await params;
  const task = await getTaskDetail(id);
  if (!task) notFound();

  const [allLabels, candidates] = await Promise.all([
    prisma.taskLabel.findMany({ orderBy: { name: 'asc' } }),
    prisma.task.findMany({ where: { deletedAt: null, id: { not: id }, parentId: { not: id } }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, reference: true, title: true, status: true } }),
  ]);

  const myAssignment = task.assignees.find((a) => a.user.id === ctx.user.id);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{task.reference}</span>
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.labels.map((l) => <Badge key={l.label.id} variant="outline" style={{ borderColor: l.label.color, color: l.label.color }}>{l.label.name}</Badge>)}
          </div>
          <h1 className="font-display text-2xl font-semibold">{task.title}</h1>
          {task.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{task.description}</p>}
        </div>

        {myAssignment && <AssignmentActions taskId={task.id} state={myAssignment.state} progress={myAssignment.progressPct} />}

        {task.checklistItems.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Checklist</CardTitle></CardHeader>
            <CardContent><TaskChecklist items={task.checklistItems.map((c) => ({ id: c.id, text: c.text, isDone: c.isDone, isMilestone: c.isMilestone }))} /></CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-lg">Comments</CardTitle></CardHeader>
          <CardContent>
            <TaskComments taskId={task.id} comments={task.comments.map((c) => ({ id: c.id, body: c.body, authorName: c.author.name, createdAt: c.createdAt.toISOString() }))} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row icon={<CalendarDays className="h-4 w-4" />} label="Due">{formatDate(task.dueDate)}</Row>
            <Row icon={<Clock className="h-4 w-4" />} label="Estimate">{task.estimateMins ? `${task.estimateMins} min` : '—'}</Row>
            <Row icon={<Building2 className="h-4 w-4" />} label="Department">{task.department?.name ?? '—'}</Row>
            <Row icon={<FolderKanban className="h-4 w-4" />} label="Project">{task.project?.name ?? '—'}</Row>
            <div className="pt-1 text-xs text-muted-foreground">Created by {task.createdBy.name} · {timeAgo(task.createdAt)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Assignees</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {task.assignees.map((a) => (
              <div key={a.user.id} className="flex items-center gap-3">
                <Avatar className="h-8 w-8"><AvatarFallback className="text-[10px]">{initials(a.user.name)}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{a.user.name}</p><p className="text-xs text-muted-foreground">{a.progressPct}% complete</p></div>
                <AssigneeStateBadge state={a.state} />
              </div>
            ))}
            {task.assignees.length === 0 && <p className="text-sm text-muted-foreground">Unassigned</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Manage</CardTitle></CardHeader>
          <CardContent>
            <TaskManagePanel
              taskId={task.id}
              subtasks={task.subtasks.map((s) => ({ id: s.id, reference: s.reference, title: s.title, status: s.status }))}
              dependencies={task.dependsOn.map((d) => ({ id: d.dependsOn.id, reference: d.dependsOn.reference, title: d.dependsOn.title, status: d.dependsOn.status }))}
              candidates={candidates}
              allLabels={allLabels.map((l) => ({ id: l.id, name: l.name, color: l.color }))}
              currentLabelIds={task.labels.map((l) => l.label.id)}
              estimateMins={task.estimateMins}
              actualMins={task.actualMins}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Activity</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {task.activities.map((act) => (
              <div key={act.id} className="flex items-start gap-2 text-xs">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                <span className="text-muted-foreground"><span className="font-medium text-foreground">{act.actor?.name ?? 'System'}</span> {titleCase(act.action)} · {timeAgo(act.createdAt)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground">{icon}{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}
