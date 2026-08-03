import type { Metadata } from 'next';
import { addDays, startOfMonth, endOfMonth } from 'date-fns';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { getWorkItems, getWorkloadTable } from '@/server/services/workload-service';
import { NewEventDialog } from '@/components/calendar/new-event-dialog';
import nextDynamic from 'next/dynamic';
const CalendarView = nextDynamic(() => import('@/components/calendar/calendar-view').then((m) => m.CalendarView), {
  loading: () => <div className="h-[560px] animate-pulse rounded-lg bg-secondary" />,
});

export const metadata: Metadata = { title: 'Calendar' };
export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const ctx = await requirePermission('calendar.view');
  const seesEveryone = can(ctx.permissions, 'admin.user.view') || can(ctx.permissions, 'lead.assign');

  const from = addDays(startOfMonth(new Date()), -40);
  const to = addDays(endOfMonth(new Date()), 70);

  const canManage = can(ctx.permissions, 'calendar.manage');

  const [items, workload, users, invitees, projects] = await Promise.all([
    getWorkItems({ from, to, userIds: seesEveryone ? undefined : [ctx.user.id] }),
    seesEveryone ? getWorkloadTable() : Promise.resolve([]),
    seesEveryone
      ? prisma.user.findMany({ where: { status: 'ACTIVE', deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
      : Promise.resolve([]),
    // Anyone who can be invited — a separate read from `users`, which only loads
    // for people who can see everybody's workload. Without it, somebody with
    // calendar rights but not user-view rights got a guest list of nobody.
    canManage
      ? prisma.user.findMany({ where: { status: 'ACTIVE', deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => [])
      : Promise.resolve([]),
    canManage
      ? prisma.project.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }).catch(() => [])
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader title="Calendar" description="Tasks, follow-ups, approvals, collections and meetings — everything with a date on it.">
        <Button asChild variant="outline" size="sm"><a href="/api/calendar/ics"><Download className="h-4 w-4" /> Add to my calendar (ICS)</a></Button>
        {canManage && <NewEventDialog projects={projects} users={invitees.filter((u) => u.id !== ctx.user.id)} />}
      </PageHeader>
      <CalendarView
        items={items}
        workload={workload}
        users={users}
        meId={ctx.user.id}
        canSeeEveryone={seesEveryone}
      />
    </div>
  );
}
