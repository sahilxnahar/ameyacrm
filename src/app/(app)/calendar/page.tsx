import type { Metadata } from 'next';
import { CalendarDays, MapPin, Download } from 'lucide-react';
import { requirePermission } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime, titleCase } from '@/lib/utils/format';

export const metadata: Metadata = { title: 'Calendar' };

export default async function CalendarPage() {
  await requirePermission('calendar.view');
  const events = await prisma.calendarEvent.findMany({ where: { startAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }, orderBy: { startAt: 'asc' }, take: 100, include: { project: { select: { name: true } } } });
  return (
    <div>
      <PageHeader title="Calendar" description="Meetings, site visits, deadlines and milestones.">
        <Button asChild variant="outline" size="sm"><a href="/api/calendar/ics"><Download className="h-4 w-4" /> Add to my calendar (ICS)</a></Button>
      </PageHeader>
      <div className="space-y-2">
        {events.length === 0 && <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">No upcoming events.</p>}
        {events.map((e) => (
          <Card key={e.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-11 w-11 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary"><CalendarDays className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{e.title}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(e.startAt)}{e.location && <span className="ml-2"><MapPin className="inline h-3 w-3" /> {e.location}</span>}</p>
              </div>
              <Badge variant="secondary">{titleCase(e.type)}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
