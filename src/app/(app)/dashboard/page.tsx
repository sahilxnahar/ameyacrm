import type { Metadata } from 'next';
import Link from 'next/link';
import { CheckSquare, Clock, CalendarClock, CheckCircle2, Inbox, FileStack, Plus } from 'lucide-react';
import { requireAuth } from '@/lib/auth/current-user';
import { getDashboardData } from '@/server/services/dashboard-service';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/layout/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PriorityBadge } from '@/components/tasks/badges';
import { formatDate, timeAgo } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const { user } = await requireAuth();
  const data = await getDashboardData(user.id);
  const firstName = user.name.split(' ')[0];

  return (
    <div>
      <PageHeader title={`Good day, ${firstName}`} description="Here's what needs your attention today.">
        <Button asChild size="sm"><Link href="/tasks?new=1"><Plus className="h-4 w-4" /> New task</Link></Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open assigned work" value={data.stats.assignedOpen} icon={CheckSquare} />
        <StatCard label="Due today" value={data.stats.dueTodayCount} icon={Clock} tone="warning" />
        <StatCard label="Awaiting your approval" value={data.stats.pendingApprovals} icon={Inbox} tone={data.stats.pendingApprovals ? 'destructive' : 'default'} />
        <StatCard label="Completed this week" value={data.stats.completedThisWeek} icon={CheckCircle2} tone="success" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Today's tasks */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg">Today&apos;s tasks</CardTitle>
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

        {/* Upcoming deadlines */}
        <Card>
          <CardHeader><CardTitle className="text-lg"><CalendarClock className="mr-2 inline h-4 w-4" />Upcoming</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.upcoming.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No deadlines this week.</p>
            ) : (
              data.upcoming.map((t) => (
                <Link key={t.id} href={`/tasks/${t.id}`} className="flex items-center justify-between gap-2 rounded-md p-2 text-sm hover:bg-secondary">
                  <span className="min-w-0 flex-1 truncate">{t.title}</span>
                  <Badge variant="outline">{formatDate(t.dueDate, 'dd MMM')}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent files */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg"><FileStack className="mr-2 inline h-4 w-4" />Recent documents</CardTitle>
            <Button asChild variant="ghost" size="sm"><Link href="/documents">Open library</Link></Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.recentDocuments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No documents yet.</p>
            ) : (
              data.recentDocuments.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2 rounded-md p-2 text-sm hover:bg-secondary">
                  <span className="min-w-0 flex-1 truncate">{d.title}</span>
                  <span className="text-xs text-muted-foreground">{d.folder.name} · {timeAgo(d.updatedAt)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Announcements */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Department updates</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.announcements.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No announcements.</p>
            ) : (
              data.announcements.map((a) => (
                <div key={a.id} className="border-l-2 border-primary/40 pl-3">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    {a.department?.name ?? 'Organization'} · {timeAgo(a.createdAt)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
