import 'server-only';
import { prisma } from '@/lib/db/prisma';

export interface DueRow {
  id: string;
  bookingRef: string;
  buyer: string;
  buyerPhone: string | null;
  unit: string | null;
  project: string | null;
  label: string;
  amount: number;
  dueDate: string | null;
  status: string;
  daysLate: number;      // negative means not due yet
  bucket: 'not-due' | '0-30' | '31-60' | '61-90' | '90+';
}

export interface Receivables {
  rows: DueRow[];
  totalOutstanding: number;
  totalOverdue: number;
  dueThisMonth: number;
  buckets: Array<{ key: string; label: string; amount: number; count: number }>;
  topDebtors: Array<{ buyer: string; amount: number; oldestDays: number; phone: string | null }>;
}

const BUCKETS: Array<{ key: DueRow['bucket']; label: string }> = [
  { key: 'not-due', label: 'Not due yet' },
  { key: '0-30', label: '1–30 days late' },
  { key: '31-60', label: '31–60 days late' },
  { key: '61-90', label: '61–90 days late' },
  { key: '90+', label: 'Over 90 days late' },
];

function bucketFor(daysLate: number): DueRow['bucket'] {
  if (daysLate <= 0) return 'not-due';
  if (daysLate <= 30) return '0-30';
  if (daysLate <= 60) return '31-60';
  if (daysLate <= 90) return '61-90';
  return '90+';
}

/**
 * What buyers still owe, aged.
 *
 * The cash book answers "what have we paid". This answers the other half, and
 * ageing is the point: one lakh a week late and one lakh six months late are
 * not the same problem, and a single outstanding total hides that completely.
 */
export async function getReceivables(projectId: string | null): Promise<Receivables> {
  const milestones = await prisma.paymentMilestone.findMany({
    where: {
      status: { not: 'PAID' },
      booking: { status: { not: 'CANCELLED' }, ...(projectId ? { unit: { projectId } } : {}) },
    },
    take: 2000,
    orderBy: [{ dueDate: 'asc' }],
    select: {
      id: true, label: true, amount: true, dueDate: true, status: true,
      booking: {
        select: {
          reference: true,
          lead: { select: { name: true, phone: true } },
          unit: { select: { code: true, project: { select: { name: true } } } },
        },
      },
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const rows: DueRow[] = milestones.map((m) => {
    const daysLate = m.dueDate
      ? Math.floor((today.getTime() - new Date(m.dueDate).setHours(0, 0, 0, 0)) / 864e5)
      : 0;
    return {
      id: m.id,
      bookingRef: m.booking.reference,
      buyer: m.booking.lead?.name ?? 'Unnamed buyer',
      buyerPhone: m.booking.lead?.phone ?? null,
      unit: m.booking.unit?.code ?? null,
      project: m.booking.unit?.project?.name ?? null,
      label: m.label,
      amount: Number(m.amount),
      dueDate: m.dueDate ? m.dueDate.toISOString() : null,
      status: m.status,
      daysLate,
      bucket: m.dueDate ? bucketFor(daysLate) : 'not-due',
    };
  });

  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const byBuyer = new Map<string, { amount: number; oldestDays: number; phone: string | null }>();
  for (const r of rows) {
    const e = byBuyer.get(r.buyer) ?? { amount: 0, oldestDays: 0, phone: r.buyerPhone };
    e.amount += r.amount;
    e.oldestDays = Math.max(e.oldestDays, r.daysLate);
    byBuyer.set(r.buyer, e);
  }

  return {
    rows,
    totalOutstanding: rows.reduce((s, r) => s + r.amount, 0),
    totalOverdue: rows.filter((r) => r.daysLate > 0).reduce((s, r) => s + r.amount, 0),
    dueThisMonth: rows
      .filter((r) => r.dueDate && new Date(r.dueDate) <= monthEnd && r.daysLate <= 0)
      .reduce((s, r) => s + r.amount, 0),
    buckets: BUCKETS.map((b) => {
      const inB = rows.filter((r) => r.bucket === b.key);
      return { key: b.key, label: b.label, amount: inB.reduce((s, r) => s + r.amount, 0), count: inB.length };
    }),
    topDebtors: [...byBuyer.entries()]
      .map(([buyer, v]) => ({ buyer, ...v }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10),
  };
}
