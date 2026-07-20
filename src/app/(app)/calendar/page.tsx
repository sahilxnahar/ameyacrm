import type { Metadata } from 'next';
import { addDays, startOfMonth, endOfMonth } from 'date-fns';
import { requirePermission } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { getWorkItems, getWorkloadTable } from '@/server/services/workload-service';
import dynamic from 'next/dynamic';
const CalendarView = dynamic(() => import('@/components/calendar/calendar-view').then((m) => m.CalendarView), {
  loading: () => <div className="h-[560px] animate-pulse rounded-lg bg-secondary" />,
});

export const metadata: Metadata = { title: 'Calendar' };
export const dynamic = 'force-dynamic';

export default async function CalendarPage() {
  const ctx = await requirePermission('calendar.view');
  const seesEveryone = can(ctx.permissions, 'admin.user.view') || can(ctx.permissions, 'lead.assign');

  const from = addDays(startOfMonth(new Date()), -40);
  const to = addDays(endOfMonth(new Date()), 70);

  const [items, workload, users] = await Promise.all([
    getWorkItems({ from, to, userIds: seesEveryone ? undefined : [ctx.user.id] }),
    seesEveryone ? getWorkloadTable() : Promise.resolve([]),
    seesEveryone
      ? prisma.user.findMany({ where: { status: 'ACTIVE', deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } })
      : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader title="Calendar" description="Tasks, follow-ups, approvals, collections and meetings — everything with a date on it.">
        <Button asChild variant="outline" size="sm"><a href="/api/calendar/ics"><Download className="h-4 w-4" /> Add to my calendar (ICS)</a></Button>
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
