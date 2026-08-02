import 'server-only';
import { endOfDay, startOfDay, addDays } from 'date-fns';
import { prisma } from '@/lib/db/prisma';
import type { LeadStatus } from '@prisma/client';

export type Urgency = 'overdue' | 'today' | 'soon';
export interface TodayItem {
  kind: 'reminder' | 'task' | 'approval' | 'followup' | 'lead' | 'payment' | 'event' | 'workrequest' | 'renewal';
  urgency: Urgency;
  title: string;
  detail: string;
  href: string;
  when?: string;
}

/** Everything on ONE person's plate today, ranked by urgency. */
export async function getTodayList(userId: string): Promise<TodayItem[]> {
  const now = new Date();
  const dayStart = startOfDay(now);
  const dayEnd = endOfDay(now);
  const weekEnd = addDays(now, 7);
  const cold = addDays(now, -3);
  // Prisma will not take a readonly array.
  const OPEN = { notIn: ['WON', 'LOST'] as LeadStatus[] };
  const t = (d: Date | null | undefined) => (d ? d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : undefined);

  const [reminders, tasks, approvals, followups, hotCold, duePayments, events, workRequests] = await Promise.all([
    prisma.reminder.findMany({ where: { userId, status: 'PENDING', dueAt: { lte: weekEnd } }, orderBy: { dueAt: 'asc' }, take: 25 }),
    prisma.task.findMany({
      where: { deletedAt: null, status: { notIn: ['DONE', 'CANCELLED'] }, assignees: { some: { userId } }, dueDate: { not: null, lte: weekEnd } },
      orderBy: [{ dueDate: 'asc' }], take: 25,
      select: { id: true, reference: true, title: true, priority: true, dueDate: true },
    }),
    prisma.approvalStep.findMany({
      where: { approverId: userId, status: 'PENDING' }, take: 15,
      include: { request: { select: { entityType: true, entityId: true } } },
    }),
    prisma.lead.findMany({
      where: { deletedAt: null, ownerId: userId, status: OPEN, nextFollowUp: { not: null, lte: dayEnd } },
      orderBy: { nextFollowUp: 'asc' }, take: 20,
      select: { id: true, name: true, reference: true, nextFollowUp: true },
    }),
    prisma.lead.findMany({
      where: { deletedAt: null, ownerId: userId, temperature: 'HOT', status: OPEN, updatedAt: { lt: cold } },
      orderBy: { updatedAt: 'asc' }, take: 10,
      select: { id: true, name: true, reference: true, updatedAt: true },
    }),
    prisma.paymentMilestone.findMany({
      where: { status: 'OVERDUE', booking: { salesRepId: userId } }, take: 15,
      include: { booking: { select: { reference: true, lead: { select: { name: true } } } } },
    }),
    // Calendar events on today's date that I organise or am invited to.
    prisma.calendarEvent.findMany({
      where: { startAt: { gte: dayStart, lte: dayEnd }, OR: [{ organizerId: userId }, { attendees: { some: { userId } } }] },
      orderBy: { startAt: 'asc' }, take: 15,
      select: { id: true, title: true, startAt: true, location: true, type: true },
    }),
    // Open inter-department work requests that land on me.
    prisma.workRequest.findMany({
      where: { ownerId: userId, closedAt: null, status: { notIn: ['CLOSED', 'DONE', 'CANCELLED', 'REJECTED'] } },
      orderBy: [{ dueOn: 'asc' }], take: 15,
      select: { id: true, reference: true, title: true, dueOn: true, status: true },
    }),
  ]);

  const items: TodayItem[] = [];
  const rank = (d: Date | null | undefined): Urgency => (!d ? 'soon' : d < dayStart ? 'overdue' : d <= dayEnd ? 'today' : 'soon');

  for (const r of reminders) items.push({ kind: 'reminder', urgency: rank(r.dueAt), title: r.title, detail: r.notes ?? 'Reminder', href: r.leadId ? `/sales/${r.leadId}` : '/reminders', when: t(r.dueAt) });
  for (const k of tasks) items.push({ kind: 'task', urgency: rank(k.dueDate), title: k.title, detail: `${k.reference} · ${k.priority.toLowerCase()} priority`, href: `/tasks/${k.id}`, when: t(k.dueDate) });
  const pretty = (v?: string) => (v ? v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ') : 'Request');
  for (const a of approvals) items.push({ kind: 'approval', urgency: 'today', title: `${pretty(a.request?.entityType)} approval`, detail: 'Awaiting your decision', href: '/approvals' });
  for (const l of followups) items.push({ kind: 'followup', urgency: rank(l.nextFollowUp), title: `Follow up: ${l.name}`, detail: `${l.reference} · follow-up scheduled`, href: `/sales/${l.id}`, when: t(l.nextFollowUp) });
  for (const l of hotCold) items.push({ kind: 'lead', urgency: 'overdue', title: `${l.name} is going cold`, detail: `${l.reference} · hot lead, no activity 3+ days`, href: `/sales/${l.id}` });
  for (const m of duePayments) items.push({ kind: 'payment', urgency: 'overdue', title: `Collect: ${m.booking?.lead?.name ?? m.booking?.reference ?? 'payment'}`, detail: `${m.label} · Rs.${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(m.amount))} overdue`, href: '/billing', when: t(m.dueDate) });
  for (const e of events) items.push({ kind: 'event', urgency: rank(e.startAt), title: e.title, detail: e.location ?? e.type, href: '/calendar', when: t(e.startAt) });
  for (const w of workRequests) items.push({ kind: 'workrequest', urgency: w.dueOn ? rank(w.dueOn) : 'soon', title: w.title, detail: `${w.reference} · ${w.status.toLowerCase().replace(/_/g, ' ')}`, href: '/work-requests', when: t(w.dueOn) });

  // Anything with an expiry that will hurt if it passes — a contract renewal
  // date, an insurance policy, a licence, a power of attorney. These registers
  // are only worth keeping if the date reaches somebody before it arrives.
  try {
    const { upcomingExpiries } = await import('@/server/services/compliance-service');
    for (const e of await upcomingExpiries(45)) {
      items.push({
        kind: 'renewal',
        urgency: e.days < 0 ? 'overdue' : e.days <= 1 ? 'today' : 'soon',
        title: `${e.kind}: ${e.title}`,
        detail: e.days < 0 ? `expired ${Math.abs(e.days)} day${Math.abs(e.days) === 1 ? '' : 's'} ago${e.who ? ` · ${e.who}` : ''}` : `in ${e.days} day${e.days === 1 ? '' : 's'}${e.who ? ` · ${e.who}` : ''}`,
        href: e.href,
        when: e.on.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      });
    }
  } catch { /* the rest of the list still stands */ }

  const order: Record<Urgency, number> = { overdue: 0, today: 1, soon: 2 };
  return items.sort((a, b) => order[a.urgency] - order[b.urgency]);
}
