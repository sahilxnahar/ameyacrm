'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';
import { datetimeLocalToUTC } from '@/lib/date/ist';

/**
 * Meetings, site visits and anything else with a time on it.
 *
 * `CalendarEvent` shipped with a table, a permission (`calendar.manage`), an ICS
 * feed and a month grid that draws events — and no way whatsoever to create one.
 * Nothing in the app wrote to the table, so the permission granted the right to
 * do something that could not be done, and the meetings row of the calendar was
 * permanently empty. These are the writers.
 */

export type CalendarResult = { ok: true; id: string } | { error: string };

const EVENT_TYPES = ['MEETING', 'SITE_VISIT', 'DEADLINE', 'TASK', 'HOLIDAY', 'MILESTONE', 'REMINDER'] as const;

const eventSchema = z.object({
  title: z.string().min(2, 'Give it a title.').max(200),
  description: z.string().max(2000).optional().nullable(),
  type: z.enum(EVENT_TYPES).default('MEETING'),
  projectId: z.string().optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  startAt: z.string().min(1, 'When does it start?'),
  endAt: z.string().optional().nullable(),
  allDay: z.coerce.boolean().default(false),
  attendeeIds: z.array(z.string()).default([]),
});

type When = { error: string } | { start: Date; end: Date | null };

function parseWhen(startAt: string, endAt: string | null | undefined, allDay: boolean): When {
  // Calendar entries are IST wall-clock — see datetimeLocalToUTC.
  const start = datetimeLocalToUTC(startAt) ?? new Date(startAt);
  if (Number.isNaN(start.getTime())) return { error: 'That start date does not look right.' };
  const end = endAt ? (datetimeLocalToUTC(endAt) ?? new Date(endAt)) : null;
  if (end && Number.isNaN(end.getTime())) return { error: 'That end date does not look right.' };
  // An event that ends before it starts sorts and renders wrongly everywhere it
  // appears, and nothing downstream re-checks it. Catch it once, here.
  if (end && !allDay && end < start) return { error: 'It cannot end before it starts.' };
  return { start, end };
}

export async function createCalendarEvent(input: unknown): Promise<CalendarResult> {
  try {
    const ctx = await ensure('calendar.manage');
    const d = eventSchema.parse(input);
    const when = parseWhen(d.startAt, d.endAt, d.allDay);
    if ('error' in when) return when;

    const event = await prisma.calendarEvent.create({
      data: {
        title: d.title.trim(),
        description: d.description?.trim() || null,
        type: d.type,
        projectId: d.projectId || null,
        location: d.location?.trim() || null,
        startAt: when.start,
        endAt: when.end,
        allDay: d.allDay,
        organizerId: ctx.user.id,
        // The organiser is always an attendee. Leaving them off meant the person
        // who called the meeting could not see it in "just me".
        attendees: {
          create: [...new Set([ctx.user.id, ...d.attendeeIds])].map((userId) => ({
            userId,
            response: userId === ctx.user.id ? ('ACCEPTED' as const) : ('NEEDS_ACTION' as const),
          })),
        },
      },
      select: { id: true },
    });

    await writeAudit({
      actorId: ctx.user.id, action: 'CREATE', entityType: 'CalendarEvent', entityId: event.id,
      summary: `Scheduled "${d.title.trim()}" for ${when.start.toISOString().slice(0, 16).replace('T', ' ')}`,
    });
    revalidatePath('/calendar'); revalidatePath('/today');
    return { ok: true, id: event.id };
  } catch (err) { return toActionError(err); }
}

export async function updateCalendarEvent(input: unknown): Promise<CalendarResult> {
  try {
    const ctx = await ensure('calendar.manage');
    const d = eventSchema.extend({ id: z.string().min(1) }).parse(input);
    const when = parseWhen(d.startAt, d.endAt, d.allDay);
    if ('error' in when) return when;

    const existing = await prisma.calendarEvent.findUnique({ where: { id: d.id }, select: { id: true, title: true } });
    if (!existing) return { error: 'That event no longer exists.' };

    await prisma.$transaction(async (tx) => {
      await tx.calendarEvent.update({
        where: { id: d.id },
        data: {
          title: d.title.trim(),
          description: d.description?.trim() || null,
          type: d.type,
          projectId: d.projectId || null,
          location: d.location?.trim() || null,
          startAt: when.start,
          endAt: when.end,
          allDay: d.allDay,
        },
      });
      // Replace the guest list wholesale. Merging leaves people invited to a
      // meeting they were deliberately taken off.
      const keep = [...new Set([...d.attendeeIds])];
      await tx.eventAttendee.deleteMany({ where: { eventId: d.id, userId: { notIn: keep.length ? keep : ['—'] } } });
      for (const userId of keep) {
        await tx.eventAttendee.upsert({
          where: { eventId_userId: { eventId: d.id, userId } },
          create: { eventId: d.id, userId },
          update: {},
        });
      }
    });

    await writeAudit({
      actorId: ctx.user.id, action: 'UPDATE', entityType: 'CalendarEvent', entityId: d.id,
      summary: `Changed "${existing.title}" → "${d.title.trim()}"`,
    });
    revalidatePath('/calendar'); revalidatePath('/today');
    return { ok: true, id: d.id };
  } catch (err) { return toActionError(err); }
}

export async function deleteCalendarEvent(id: string): Promise<CalendarResult> {
  try {
    const ctx = await ensure('calendar.manage');
    const existing = await prisma.calendarEvent.findUnique({ where: { id }, select: { id: true, title: true, startAt: true } });
    if (!existing) return { error: 'That event no longer exists.' };
    await prisma.calendarEvent.delete({ where: { id } });
    await writeAudit({
      actorId: ctx.user.id, action: 'DELETE', entityType: 'CalendarEvent', entityId: id,
      summary: `Cancelled "${existing.title}" (was ${existing.startAt.toISOString().slice(0, 16).replace('T', ' ')})`,
    });
    revalidatePath('/calendar'); revalidatePath('/today');
    return { ok: true, id };
  } catch (err) { return toActionError(err); }
}
