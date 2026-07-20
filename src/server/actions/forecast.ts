'use server';
import { z } from 'zod';
import { startOfMonth, endOfMonth } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { computeIncentive } from '@/server/services/forecast-service';

export type FcResult = { ok: true; message?: string } | { error: string };

const targetSchema = z.object({
  userId: z.string().min(1),
  month: z.string().min(7),              // yyyy-MM
  target: z.coerce.number().min(0),
  metric: z.enum(['BOOKING_VALUE', 'BOOKINGS', 'LEADS', 'SITE_VISITS']).default('BOOKING_VALUE'),
});

export async function setSalesTarget(input: unknown): Promise<FcResult> {
  try {
    const ctx = await ensure('admin.user.manage');
    const d = targetSchema.parse(input);
    const periodStart = startOfMonth(new Date(`${d.month}-01T00:00:00`));
    const periodEnd = endOfMonth(periodStart);
    await prisma.salesTarget.upsert({
      where: { userId_periodStart_metric: { userId: d.userId, periodStart, metric: d.metric } },
      update: { target: d.target, periodEnd },
      create: { userId: d.userId, periodStart, periodEnd, metric: d.metric, target: d.target },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'User', entityId: d.userId, summary: `Set ${d.metric} target for ${d.month}` });
    revalidatePath('/forecast');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

const slabSchema = z.object({
  name: z.string().min(2).max(80),
  fromValue: z.coerce.number().min(0).default(0),
  toValue: z.union([z.coerce.number(), z.literal('')]).optional(),
  ratePercent: z.coerce.number().min(0).max(100).default(0),
  flatAmount: z.union([z.coerce.number(), z.literal('')]).optional(),
});

export async function saveIncentiveSlab(input: unknown): Promise<FcResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const d = slabSchema.parse(input);
    if (!d.ratePercent && !d.flatAmount) return { error: 'Set a percentage, a flat amount, or both.' };
    await prisma.incentiveSlab.create({
      data: {
        name: d.name, fromValue: d.fromValue,
        toValue: d.toValue === '' || d.toValue === undefined ? null : Number(d.toValue),
        ratePercent: d.ratePercent,
        flatAmount: d.flatAmount === '' || d.flatAmount === undefined ? null : Number(d.flatAmount),
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Setting', summary: `Added incentive slab ${d.name}` });
    revalidatePath('/forecast');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function deleteIncentiveSlab(id: string): Promise<FcResult> {
  try {
    await ensure('admin.setting.manage');
    await prisma.incentiveSlab.update({ where: { id }, data: { isActive: false } });
    revalidatePath('/forecast');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/**
 * Recalculate incentives for a month from the bookings that actually closed.
 * Rebuilds only ACCRUED rows, so anything already approved or paid is never
 * altered behind someone's back.
 */
export async function recalculateIncentives(month: string): Promise<FcResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const periodStart = startOfMonth(new Date(`${month}-01T00:00:00`));
    const periodEnd = endOfMonth(periodStart);

    const bookings = await prisma.booking.findMany({
      where: { bookedAt: { gte: periodStart, lte: periodEnd }, status: { not: 'CANCELLED' } },
      select: { id: true, reference: true, salesRepId: true, agreementValue: true, lead: { select: { ownerId: true } } },
    });

    await prisma.incentiveEntry.deleteMany({ where: { periodStart, status: 'ACCRUED' } });

    let created = 0;
    for (const b of bookings) {
      const userId = b.salesRepId ?? b.lead?.ownerId;
      const value = Number(b.agreementValue ?? 0);
      if (!userId || value <= 0) continue;

      const locked = await prisma.incentiveEntry.findFirst({
        where: { bookingId: b.id, status: { in: ['APPROVED', 'PAID'] } }, select: { id: true },
      });
      if (locked) continue;

      const calc = await computeIncentive(value);
      if (!calc) continue;
      await prisma.incentiveEntry.create({
        data: { userId, bookingId: b.id, periodStart, baseValue: value, amount: calc.amount, slabName: calc.slabName, note: b.reference },
      });
      created++;
    }

    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Setting', summary: `Recalculated incentives for ${month}: ${created} entries` });
    revalidatePath('/forecast');
    return { ok: true, message: `${created} incentive ${created === 1 ? 'entry' : 'entries'} calculated. Approved and paid entries were left untouched.` };
  } catch (err) { return toActionError(err); }
}

export async function setIncentiveStatus(id: string, status: 'ACCRUED' | 'APPROVED' | 'PAID'): Promise<FcResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    await prisma.incentiveEntry.update({
      where: { id },
      data: { status, approvedAt: status === 'APPROVED' ? new Date() : undefined, paidAt: status === 'PAID' ? new Date() : undefined },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Setting', entityId: id, summary: `Incentive marked ${status}` });
    revalidatePath('/forecast');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function saveProbabilities(map: Record<string, number>): Promise<FcResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    await prisma.setting.upsert({ where: { key: 'forecast.probability' }, update: { value: map }, create: { key: 'forecast.probability', value: map } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Setting', summary: 'Updated stage probabilities' });
    revalidatePath('/forecast');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}
