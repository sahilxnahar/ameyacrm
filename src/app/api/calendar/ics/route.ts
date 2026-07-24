import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/current-user';
import { buildIcs } from '@/lib/calendar/ics';

/** Downloadable ICS feed of the signed-in user's events (meetings, site visits, deadlines). */
export async function GET() {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const events = await prisma.calendarEvent.findMany({
    where: { OR: [{ organizerId: ctx.user.id }, { attendees: { some: { userId: ctx.user.id } } }] },
    orderBy: { startAt: 'asc' }, take: 500,
  });
  const ics = buildIcs(events.map((e) => ({ id: e.id, title: e.title, description: e.description, location: e.location, start: e.startAt, end: e.endAt, allDay: e.allDay })));
  return new NextResponse(ics, { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="ameya-heights.ics"' } });
}
