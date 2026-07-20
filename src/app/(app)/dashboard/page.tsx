import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CheckSquare, Clock, Inbox, Plus, Flame, BellRing, Wallet, Home, TrendingUp,
  Users2, CalendarCheck, FileStack, Percent,
} from 'lucide-react';
import { requireAuth } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { getDashboardData } from '@/server/services/dashboard-service';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/layout/stat-card';
import { ActionCard } from '@/components/dashboard/action-card';
import { QuickAddLead } from '@/components/dashboard/quick-add-lead';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PriorityBadge } from '@/components/tasks/badges';
import { formatCurrency, timeAgo } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const { user } = await requireAuth();
  const data = await getDashboardData(user.id);
  const firstName = user.name.split(' ')[0];
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const num = (v: unknown) => Number(v || 0);

  const [newLeads7d, hotLeads, siteVisits7d, totalLeads, wonLeads, remindersDue, overdue, availableUnits, msAgg] = await Promise.all([
    prisma.lead.count({ where: { deletedAt: null, createdAt: { gte: weekAgo } } }),
    prisma.lead.count({ where: { deletedAt: null, temperature: 'HOT', status: { notIn: ['WON', 'LOST'] } } }),
    prisma.leadActivity.count({ where: { type: 'SITE_VISIT', occurredAt: { gte: weekAgo } } }),
    prisma.lead.count({ where: { deletedAt: null } }),
    prisma.lead.count({ where: { deletedAt: null, status: { in: ['BOOKED', 'WON'] } } }),
    prisma.reminder.count({ where: { userId: user.id, status: 'PENDING', dueAt: { lte: now } } }),
    prisma.paymentMilestone.aggregate({ where: { status: 'OVERDUE' }, _count: true, _sum: { amount: true } }),
    prisma.unit.count({ where: { status: 'AVAILABLE' } }),
    prisma.paymentMilestone.groupBy({ by: ['status'], _sum: { amount: true } }),
  ]);

  const paid = num(msAgg.find((m) => m.status === 'PAID')?._sum.amount);
  const totalDue = msAgg.reduce((s, m) => s + num(m._sum.amount), 0);
  const collectionRate = totalDue > 0 ? Math.round((paid / totalDue) * 100) : 0;
  const winRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;
  const overdueAmount = num(overdue._sum.amount);

  return (
    <div>
      <PageHeader title={`Good day, ${firstName}`} description="Here's what needs your attention today.">
        <Button asChild size="sm"><Link href="/tasks?new=1"><Plus className="h-4 w-4" /> New task</Link></Button>
      </PageHeader>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="New leads" value={newLeads7d} icon={Users2} hint="last 7 days" />
        <StatCard label="Site visits" value={siteVisits7d} icon={CalendarCheck} hint="last 7 days" />
        <StatCard label="Lead → win rate" value={`${winRate}%`} icon={TrendingUp} tone="success" hint={`${wonLeads} of ${totalLeads}`} />
        <StatCard label="Collections" value={`${collectionRate}%`} icon={Percent} tone={collectionRate < 50 ? 'warning' : 'success'} hint={`${formatCurrency(paid)} received`} />
        <StatCard label="Open work" value={data.stats.assignedOpen} icon={CheckSquare} hint={`${data.stats.dueTodayCount} due today`} />
      </div>

      {/* Action cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ActionCard title="Hot leads" icon={Flame} tone="danger" value={hotLeads}
          caption="marked hot and still open — call them first"
          emptyCaption="No hot leads right now. Mark your best prospects hot."
          cta="Work hot leads" href="/reports/explorer?entity=leads&temperature=HOT" />

        <ActionCard title="Reminders due" icon={BellRing} tone="warning" value={remindersDue}
          caption="follow-ups waiting on you"
          emptyCaption="You're all caught up. Nothing overdue."
          cta="Open reminders" href="/reminders" />

        <ActionCard title="Overdue payments" icon={Wallet} tone="danger" value={overdue._count ? formatCurrency(overdueAmount) : 0}
          caption={`${overdue._count} milestone(s) past due — chase collections`}
          emptyCaption="Nothing overdue. Collections are on track."
          cta="Chase collections" href="/billing" />

        <ActionCard title="Available inventory" icon={Home} tone="success" value={availableUnits}
          caption="units ready to sell right now"
          emptyCaption="No available units. Add inventory to your projects."
          cta="Open inventory" href="/inventory" />

        <ActionCard title="Awaiting approval" icon={Inbox} tone="info" value={data.stats.pendingApprovals}
          caption="requests need your decision"
          emptyCaption="No approvals pending. Nothing blocked."
          cta="Review approvals" href="/approvals" />

        <QuickAddLead />
      </div>

      {/* Detail lists */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg"><Clock className="mr-2 inline h-4 w-4" />Today&apos;s tasks</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link href="/tasks">View all</Link></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.dueToday.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing due today. Enjoy the calm.</p>
            ) : (
              data.dueToday.map((t) => (
                <Link key={t.id} href={`/tasks/${t.id}`} className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:bg-secondary">
                  <span className="font-mono text-xs text-muted-foreground">{t.reference}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.title}</span>
                  <PriorityBadge priority={t.priority} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg"><FileStack className="mr-2 inline h-4 w-4" />Recent files</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link href="/documents">Library</Link></Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.recentDocuments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No documents yet.</p>
            ) : (
              data.recentDocuments.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2 rounded-md p-2 text-sm hover:bg-secondary">
                  <span className="min-w-0 flex-1 truncate">{d.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(d.updatedAt)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
