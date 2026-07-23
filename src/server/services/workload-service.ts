import 'server-only';
import { startOfDay, endOfDay, addDays } from 'date-fns';
import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';

export type WorkKind = 'TASK' | 'REMINDER' | 'APPROVAL' | 'COLLECTION' | 'EVENT';

export interface WorkItem {
  id: string;
  kind: WorkKind;
  title: string;
  detail?: string;
  due: string;            // ISO
  ownerId: string | null;
  ownerName: string | null;
  href: string;
  priority?: string;
  amount?: number;
}

export interface WorkloadRow {
  userId: string;
  name: string;
  departmentName: string | null;
  overdue: number;
  today: number;
  next7: number;
  later: number;
  total: number;
  nextDue: string | null;
}

/**
 * Every piece of dated work in the system, from four sources, normalised into
 * one shape. The calendar and the admin workload table are two views of this.
 */
export async function getWorkItems(opts: { from: Date; to: Date; userIds?: string[]; light?: boolean }): Promise<WorkItem[]> {
  const { from, to, userIds, light } = opts;
  const range = { gte: from, lte: to };
  const items: WorkItem[] = [];

  // In light mode nobody reads the labels, so skip the user lookup entirely.
  const users = light ? [] : await prisma.user.findMany({ where: { deletedAt: null }, select: { id: true, name: true } });
  const nameOf = new Map(users.map((u) => [u.id, u.name]));
  const inScope = (id: string | null | undefined) => !userIds || (id ? userIds.includes(id) : false);

  // 1 — tasks with a due date
  const tasks = await prisma.task.findMany({
    where: { deletedAt: null, dueDate: range, status: { not: 'DONE' } },
    select: { id: true, reference: !light, title: !light, dueDate: true, priority: !light, status: !light, assignees: { select: { userId: true, state: true } } },
    take: 800,
  });
  for (const t of tasks) {
    // Only assignees still on the hook. Someone who has marked their part
    // COMPLETED (or REJECTED it) should not keep seeing it as pending or get
    // chased about it — even if the overall task is still open.
    const owners = t.assignees.length
      ? t.assignees.filter((a) => a.state !== 'COMPLETED' && a.state !== 'REJECTED').map((a) => a.userId)
      : [null];
    for (const ownerId of owners) {
      if (!inScope(ownerId)) continue;
      items.push({
        id: `task:${t.id}:${ownerId ?? 'none'}`, kind: 'TASK', title: t.title ?? '',
        detail: t.reference, due: t.dueDate!.toISOString(),
        ownerId, ownerName: ownerId ? nameOf.get(ownerId) ?? null : null,
        href: '/tasks', priority: t.priority,
      });
    }
  }

  // 2 — reminders and lead follow-ups
  const reminders = await prisma.reminder.findMany({
    where: { dueAt: range, status: 'PENDING' },
    select: { id: true, title: !light, notes: !light, dueAt: true, userId: true, leadId: !light },
    take: 500,
  });
  for (const r of reminders) {
    if (!inScope(r.userId)) continue;
    items.push({
      id: `rem:${r.id}`, kind: 'REMINDER', title: r.title ?? '', detail: r.notes ?? undefined,
      due: r.dueAt.toISOString(), ownerId: r.userId, ownerName: nameOf.get(r.userId) ?? null,
      href: r.leadId ? `/sales?lead=${r.leadId}` : '/reminders',
    });
  }

  const followUps = await prisma.lead.findMany({
    where: { deletedAt: null, nextFollowUp: range, status: { notIn: ['WON', 'LOST'] } },
    select: { id: true, name: !light, reference: !light, nextFollowUp: true, ownerId: true, temperature: !light },
    take: 500,
  });
  for (const l of followUps) {
    if (!inScope(l.ownerId)) continue;
    items.push({
      id: `lead:${l.id}`, kind: 'REMINDER', title: l.name ? `Follow up: ${l.name}` : '', detail: l.reference ?? undefined,
      due: l.nextFollowUp!.toISOString(), ownerId: l.ownerId, ownerName: l.ownerId ? nameOf.get(l.ownerId) ?? null : null,
      href: `/sales?lead=${l.id}`, priority: l.temperature === 'HOT' ? 'URGENT' : undefined,
    });
  }

  // 3 — approvals sitting in someone's queue
  const steps = await prisma.approvalStep.findMany({
    where: { status: 'PENDING', request: { status: 'PENDING', createdAt: { lte: to } } },
    select: { id: true, approverId: true, createdAt: true, request: { select: { id: true, entityType: true, entityId: true, createdAt: true } } },
    take: 400,
  });
  for (const s of steps) {
    if (!inScope(s.approverId)) continue;
    const due = s.request.createdAt;
    if (due < from || due > to) continue;
    items.push({
      id: `appr:${s.id}`, kind: 'APPROVAL',
      title: `Approve ${s.request.entityType.replace(/_/g, ' ').toLowerCase()}`,
      detail: s.request.entityId.slice(0, 8),
      due: due.toISOString(), ownerId: s.approverId, ownerName: nameOf.get(s.approverId) ?? null,
      href: '/approvals',
    });
  }

  // 4 — overdue collections, attributed to the rep who owns the booking
  const milestones = await prisma.paymentMilestone.findMany({
    where: { status: { not: 'PAID' }, dueDate: range },
    select: {
      id: true, label: true, amount: true, dueDate: true,
      booking: { select: { reference: true, salesRepId: true, lead: { select: { name: true, ownerId: true } } } },
    },
    take: 500,
  });
  for (const m of milestones) {
    const ownerId = m.booking?.salesRepId ?? m.booking?.lead?.ownerId ?? null;
    if (!inScope(ownerId)) continue;
    items.push({
      id: `pay:${m.id}`, kind: 'COLLECTION',
      title: `Collect ${m.label}`,
      detail: `${m.booking?.reference ?? ''} ${m.booking?.lead?.name ?? ''}`.trim(),
      due: m.dueDate!.toISOString(), ownerId, ownerName: ownerId ? nameOf.get(ownerId) ?? null : null,
      href: '/billing', amount: Number(m.amount),
    });
  }

  // 5 — calendar events
  const events = await prisma.calendarEvent.findMany({
    where: { startAt: range },
    select: { id: true, title: true, startAt: true, location: true, type: true, organizerId: true },
    take: 400,
  });
  for (const e of events) {
    if (userIds && !inScope(e.organizerId)) continue;
    items.push({
      id: `evt:${e.id}`, kind: 'EVENT', title: e.title, detail: e.location ?? e.type,
      due: e.startAt.toISOString(), ownerId: e.organizerId, ownerName: e.organizerId ? nameOf.get(e.organizerId) ?? null : null,
      href: '/calendar',
    });
  }

  return items.sort((a, b) => a.due.localeCompare(b.due));
}

/** Per-person summary for the admin view: how much is late, due today, due soon. */
/**
 * Counts per person.
 *
 * This used to pull a two-year window of every task, reminder, approval and
 * instalment in the company — thousands of full records — and then throw
 * almost all of it away to produce four numbers. It now asks for a 90-day
 * window in light mode, which fetches only the owner and the date.
 */
export async function getWorkloadTable(): Promise<WorkloadRow[]> {
  const now = new Date();
  const items = await getWorkItems({
    from: addDays(startOfDay(now), -90),
    to: addDays(endOfDay(now), 90),
    light: true,
  });
  const users = await prisma.user.findMany({
    where: { deletedAt: null, status: 'ACTIVE' },
    select: { id: true, name: true, department: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });

  const todayEnd = endOfDay(now);
  const weekEnd = endOfDay(addDays(now, 7));

  return users.map((u) => {
    const mine = items.filter((i) => i.ownerId === u.id);
    const row: WorkloadRow = {
      userId: u.id, name: u.name, departmentName: u.department?.name ?? null,
      overdue: 0, today: 0, next7: 0, later: 0, total: mine.length, nextDue: null,
    };
    for (const i of mine) {
      const d = new Date(i.due);
      if (d < startOfDay(now)) row.overdue++;
      else if (d <= todayEnd) row.today++;
      else if (d <= weekEnd) row.next7++;
      else row.later++;
    }
    const upcoming = mine.filter((i) => new Date(i.due) >= startOfDay(now));
    row.nextDue = upcoming[0]?.due ?? mine[0]?.due ?? null;
    return row;
  });
}
