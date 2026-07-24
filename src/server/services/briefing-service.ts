import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { generateBriefing } from '@/lib/ai/gemini';
import type { LeadStatus } from '@prisma/client';

export interface RiskAlert { severity: 'high' | 'medium' | 'low'; title: string; detail: string; href: string }
export interface Signals { metrics: Record<string, string | number>; alerts: RiskAlert[] }

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const money = (n: number) => `Rs.${inr.format(Math.round(n))}`;

/** Gather the numbers that matter today, plus rule-based risk alerts. */
export async function collectSignals(): Promise<Signals> {
  const now = new Date();
  const d1 = new Date(now.getTime() - 86400000);
  const d7 = new Date(now.getTime() - 7 * 86400000);
  const d14 = new Date(now.getTime() - 14 * 86400000);
  const d3 = new Date(now.getTime() - 3 * 86400000);
  const soon = new Date(now.getTime() + 86400000);
  // Prisma will not take a readonly array, so this is a plain one.
  const OPEN = { notIn: ['WON', 'LOST'] as LeadStatus[] };

  const [
    newLeads24, newLeads7, hotOpen, hotStale, stalled, wonMonth,
    overdue, heldExpiring, remindersDue, openSnags, availUnits, bookings7, kycPending,
  ] = await Promise.all([
    prisma.lead.count({ where: { deletedAt: null, createdAt: { gte: d1 } } }),
    prisma.lead.count({ where: { deletedAt: null, createdAt: { gte: d7 } } }),
    prisma.lead.count({ where: { deletedAt: null, temperature: 'HOT', status: OPEN } }),
    prisma.lead.count({ where: { deletedAt: null, temperature: 'HOT', status: OPEN, updatedAt: { lt: d3 } } }),
    prisma.lead.count({ where: { deletedAt: null, status: OPEN, updatedAt: { lt: d14 } } }),
    prisma.lead.count({ where: { deletedAt: null, status: { in: ['BOOKED', 'WON'] }, updatedAt: { gte: new Date(now.getFullYear(), now.getMonth(), 1) } } }),
    prisma.paymentMilestone.aggregate({ where: { status: 'OVERDUE' }, _count: true, _sum: { amount: true } }),
    prisma.unit.count({ where: { status: 'HELD', holdUntil: { not: null, lte: soon } } }),
    prisma.reminder.count({ where: { status: 'PENDING', dueAt: { lte: now } } }),
    prisma.snagTicket.count({ where: { status: { not: 'RESOLVED' } } }),
    prisma.unit.count({ where: { status: 'AVAILABLE' } }),
    prisma.booking.count({ where: { bookedAt: { gte: d7 } } }),
    prisma.channelPartner.count({ where: { kycStatus: 'PENDING' } }),
  ]);

  const overdueAmt = Number(overdue._sum.amount ?? 0);
  const metrics: Record<string, string | number> = {
    'New leads (24h)': newLeads24,
    'New leads (7d)': newLeads7,
    'Hot leads open': hotOpen,
    'Hot leads untouched 3+ days': hotStale,
    'Leads with no activity 14+ days': stalled,
    'Bookings this month': wonMonth,
    'Bookings (7d)': bookings7,
    'Overdue payments': `${overdue._count} milestones, ${money(overdueAmt)}`,
    'Unit holds expiring in 24h': heldExpiring,
    'Reminders due now': remindersDue,
    'Open snag tickets': openSnags,
    'Units available': availUnits,
    'Channel partners awaiting KYC': kycPending,
  };

  const alerts: RiskAlert[] = [];
  if (overdue._count > 0) alerts.push({ severity: overdueAmt > 1000000 ? 'high' : 'medium', title: `${overdue._count} overdue payment(s)`, detail: `${money(overdueAmt)} past due. Interest is accruing daily.`, href: '/billing' });
  if (hotStale > 0) alerts.push({ severity: 'high', title: `${hotStale} hot lead(s) going cold`, detail: 'Marked hot but untouched for 3+ days.', href: '/reports/explorer?entity=leads&temperature=HOT' });
  if (stalled > 0) alerts.push({ severity: 'medium', title: `${stalled} stalled lead(s)`, detail: 'No activity in 14+ days and still open.', href: '/sales' });
  if (heldExpiring > 0) alerts.push({ severity: 'medium', title: `${heldExpiring} unit hold(s) expiring`, detail: 'Releasing back to inventory within 24 hours.', href: '/inventory' });
  if (remindersDue > 0) alerts.push({ severity: 'low', title: `${remindersDue} reminder(s) due`, detail: 'Follow-ups waiting across the team.', href: '/reminders' });
  if (openSnags > 0) alerts.push({ severity: 'low', title: `${openSnags} open snag ticket(s)`, detail: 'Buyer-reported issues awaiting resolution.', href: '/customers' });
  if (kycPending > 0) alerts.push({ severity: 'low', title: `${kycPending} partner(s) awaiting KYC`, detail: 'Cannot be paid brokerage until verified.', href: '/partners' });

  return { metrics, alerts };
}

export async function getBriefing(force = false) {
  const forDate = new Date().toISOString().slice(0, 10);
  const signals = await collectSignals();
  if (!force) {
    try {
      const cached = await prisma.dailyBriefing.findUnique({ where: { forDate } });
      if (cached) return { cached, signals };
    } catch { /* table may not exist yet */ }
  }
  const text = Object.entries(signals.metrics).map(([k, v]) => `- ${k}: ${v}`).join('\n');
  const b = await generateBriefing(text);
  if (!b) return { cached: null, signals };
  try {
    const saved = await prisma.dailyBriefing.upsert({
      where: { forDate },
      update: { headline: b.headline, bullets: b.bullets, actions: b.actions, metrics: signals.metrics },
      create: { forDate, headline: b.headline, bullets: b.bullets, actions: b.actions, metrics: signals.metrics },
    });
    return { cached: saved, signals };
  } catch { return { cached: null, signals }; }
}
