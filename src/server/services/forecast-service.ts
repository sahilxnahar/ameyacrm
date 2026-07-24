import 'server-only';
import { startOfMonth, endOfMonth } from 'date-fns';
import { prisma } from '@/lib/db/prisma';

/** Default odds of a lead converting, by stage. Overridable in Settings. */
export const DEFAULT_PROBABILITY: Record<string, number> = {
  NEW: 5, CONTACTED: 10, QUALIFIED: 25, SITE_VISIT: 45, NEGOTIATION: 70, BOOKED: 90, WON: 100, LOST: 0,
};

export interface RepRow {
  userId: string;
  name: string;
  target: number;
  booked: number;
  weightedPipeline: number;
  bookingCount: number;
  leadCount: number;
  attainment: number;   // % of target achieved
  incentive: number;    // accrued this period
}

export async function getProbabilities(): Promise<Record<string, number>> {
  const row = await prisma.setting.findUnique({ where: { key: 'forecast.probability' } });
  const v = row?.value as Record<string, number> | undefined;
  return { ...DEFAULT_PROBABILITY, ...(v ?? {}) };
}

/** Midpoint of the stated budget — the honest estimate when nothing better exists. */
function leadValue(l: { budgetMin: unknown; budgetMax: unknown }): number {
  const lo = l.budgetMin ? Number(l.budgetMin) : 0;
  const hi = l.budgetMax ? Number(l.budgetMax) : 0;
  if (lo && hi) return (lo + hi) / 2;
  return hi || lo || 0;
}

export async function getForecast(period?: Date): Promise<{
  periodStart: Date;
  periodEnd: Date;
  rows: RepRow[];
  totals: { target: number; booked: number; weightedPipeline: number; incentive: number };
  byStage: Array<{ stage: string; count: number; value: number; weighted: number; probability: number }>;
}> {
  const base = period ?? new Date();
  const periodStart = startOfMonth(base);
  const periodEnd = endOfMonth(base);
  const prob = await getProbabilities();

  const [users, targets, bookings, openLeads, incentives] = await Promise.all([
    prisma.user.findMany({ where: { status: 'ACTIVE', deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.salesTarget.findMany({ where: { periodStart, metric: 'BOOKING_VALUE' }, select: { userId: true, target: true } }),
    prisma.booking.findMany({
      where: { bookedAt: { gte: periodStart, lte: periodEnd }, status: { not: 'CANCELLED' } },
      select: { id: true, salesRepId: true, agreementValue: true, lead: { select: { ownerId: true } } },
    }),
    prisma.lead.findMany({
      where: { deletedAt: null, status: { notIn: ['WON', 'LOST'] } },
      select: { id: true, status: true, ownerId: true, budgetMin: true, budgetMax: true },
    }),
    prisma.incentiveEntry.findMany({ where: { periodStart }, select: { userId: true, amount: true } }),
  ]);

  const targetOf = new Map(targets.map((t) => [t.userId, Number(t.target)]));
  const rows: RepRow[] = users.map((u) => {
    const mineBookings = bookings.filter((b) => (b.salesRepId ?? b.lead?.ownerId) === u.id);
    const mineLeads = openLeads.filter((l) => l.ownerId === u.id);
    const booked = mineBookings.reduce((n, b) => n + Number(b.agreementValue ?? 0), 0);
    const weighted = mineLeads.reduce((n, l) => n + leadValue(l) * ((prob[l.status] ?? 0) / 100), 0);
    const target = targetOf.get(u.id) ?? 0;
    return {
      userId: u.id, name: u.name, target, booked,
      weightedPipeline: Math.round(weighted),
      bookingCount: mineBookings.length,
      leadCount: mineLeads.length,
      attainment: target > 0 ? Math.round((booked / target) * 100) : 0,
      incentive: incentives.filter((i) => i.userId === u.id).reduce((n, i) => n + Number(i.amount), 0),
    };
  });

  const stages = ['NEW', 'CONTACTED', 'QUALIFIED', 'SITE_VISIT', 'NEGOTIATION', 'BOOKED'];
  const byStage = stages.map((stage) => {
    const list = openLeads.filter((l) => l.status === stage);
    const value = list.reduce((n, l) => n + leadValue(l), 0);
    const p = prob[stage] ?? 0;
    return { stage, count: list.length, value: Math.round(value), weighted: Math.round((value * p) / 100), probability: p };
  });

  return {
    periodStart, periodEnd, rows, byStage,
    totals: {
      target: rows.reduce((n, r) => n + r.target, 0),
      booked: rows.reduce((n, r) => n + r.booked, 0),
      weightedPipeline: rows.reduce((n, r) => n + r.weightedPipeline, 0),
      incentive: rows.reduce((n, r) => n + r.incentive, 0),
    },
  };
}

/**
 * Work out what a booking earns the rep, using the highest slab its value
 * falls into. Returns null when no slab applies.
 */
export async function computeIncentive(bookingValue: number): Promise<{ amount: number; slabName: string } | null> {
  const slabs = await prisma.incentiveSlab.findMany({ where: { isActive: true }, orderBy: { fromValue: 'asc' } });
  const hit = slabs.filter((s) => bookingValue >= Number(s.fromValue) && (s.toValue === null || bookingValue <= Number(s.toValue))).pop();
  if (!hit) return null;
  const amount = Number(hit.flatAmount ?? 0) + (bookingValue * Number(hit.ratePercent)) / 100;
  return amount > 0 ? { amount: Math.round(amount), slabName: hit.name } : null;
}
