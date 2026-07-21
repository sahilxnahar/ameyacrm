'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';
import { priceUnit, discountApproval } from '@/lib/sales/pricing';
import { computeCommission } from '@/lib/sales/commission';
import { DISCOUNT_APPROVAL_MATRIX, COMMISSION_SLABS, COMMISSION_TDS_PCT } from '@/config/sales';

export type PricingResult = { ok: true; message: string; id?: string } | { error: string };
const num = (d: unknown): number => (d == null ? 0 : Number(d));

const pricingSchema = z.object({
  unitId: z.string().min(1),
  projectId: z.string().optional().nullable(),
  baseRatePerSqft: z.number().nonnegative(),
  baseFloor: z.number().int().min(0).optional(),
  floorRisePerSqft: z.number().nonnegative().optional(),
  plcPerSqft: z.number().nonnegative().optional(),
  viewPremiumPerSqft: z.number().nonnegative().optional(),
  lumpSum: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
});

export async function saveUnitPricing(input: unknown): Promise<PricingResult> {
  try {
    const ctx = await ensure('pricing.manage');
    const d = pricingSchema.parse(input);

    // Compute the price and check the discount against the setter's limit, so a
    // discount beyond a role's authority is flagged rather than quietly given.
    const unit = await prisma.unit.findUnique({ where: { id: d.unitId }, select: { floor: true, carpetAreaSqft: true } });
    if (!unit) return { error: 'That unit no longer exists.' };
    const priced = priceUnit({
      areaSqft: num(unit.carpetAreaSqft), baseRatePerSqft: d.baseRatePerSqft,
      floor: unit.floor ?? 0, baseFloor: d.baseFloor ?? 0, floorRisePerSqft: d.floorRisePerSqft ?? 0,
      plcPerSqft: d.plcPerSqft ?? 0, viewPremiumPerSqft: d.viewPremiumPerSqft ?? 0,
      lumpSums: [d.lumpSum ?? 0], discountAmount: d.discountAmount ?? 0,
    });
    const approval = discountApproval(priced.discountPct, ctx.user.role, DISCOUNT_APPROVAL_MATRIX);
    if (!approval.withinLimit) {
      return { error: `A ${priced.discountPct}% discount is above your ${approval.roleLimit}% limit${approval.approverNeeded ? ` — needs ${approval.approverNeeded.replace(/_/g, ' ').toLowerCase()} approval` : ''}.` };
    }

    const data = {
      projectId: d.projectId ?? null, baseRatePerSqft: d.baseRatePerSqft, baseFloor: d.baseFloor ?? 0,
      floorRisePerSqft: d.floorRisePerSqft ?? 0, plcPerSqft: d.plcPerSqft ?? 0, viewPremiumPerSqft: d.viewPremiumPerSqft ?? 0,
      lumpSum: d.lumpSum ?? 0, discountAmount: d.discountAmount ?? 0, updatedById: ctx.user.id,
    };
    await prisma.unitPricing.upsert({ where: { unitId: d.unitId }, update: data, create: { unitId: d.unitId, ...data } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'UnitPricing', entityId: d.unitId, summary: `Priced unit at ${priced.netPrice} (${priced.discountPct}% off)` });
    revalidatePath('/pricing');
    return { ok: true, message: `Saved — net price ₹${priced.netPrice.toLocaleString('en-IN')}.` };
  } catch (e) {
    return toActionError(e);
  }
}

const commissionSchema = z.object({
  channelPartnerId: z.string().min(1, 'Pick a channel partner.'),
  bookingId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  bookingValue: z.number().positive('Enter the booking value.'),
  note: z.string().max(300).optional().nullable(),
});

export async function recordCommission(input: unknown): Promise<PricingResult> {
  try {
    const ctx = await ensure('pricing.manage');
    const d = commissionSchema.parse(input);
    const partner = await prisma.channelPartner.findUnique({ where: { id: d.channelPartnerId }, select: { commissionPct: true, firmName: true } });
    if (!partner) return { error: 'That channel partner no longer exists.' };

    const pct = num(partner.commissionPct);
    const slabs = pct > 0 ? [{ fromValue: 0, ratePct: pct }] : COMMISSION_SLABS;
    const c = computeCommission({ bookingValue: d.bookingValue, slabs, tdsRatePct: COMMISSION_TDS_PCT });

    const saved = await prisma.commissionPayout.create({
      data: {
        channelPartnerId: d.channelPartnerId, bookingId: d.bookingId ?? null, projectId: d.projectId ?? null,
        bookingValue: d.bookingValue, ratePct: c.ratePct, grossCommission: c.grossCommission,
        tdsAmount: c.totalTds, netPayable: c.netPayable, note: d.note ?? null, createdById: ctx.user.id,
      },
      select: { id: true },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'CommissionPayout', entityId: saved.id, summary: `Commission for ${partner.firmName}: ${c.ratePct}% → net ${c.netPayable}` });
    revalidatePath('/pricing');
    return { ok: true, message: `Commission ₹${c.netPayable.toLocaleString('en-IN')} net (${c.ratePct}%, TDS ₹${c.totalTds.toLocaleString('en-IN')}).`, id: saved.id };
  } catch (e) {
    return toActionError(e);
  }
}

export async function advanceCommission(id: string, status: 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED'): Promise<PricingResult> {
  try {
    const ctx = await ensure('pricing.manage');
    await prisma.commissionPayout.update({ where: { id }, data: { status, paidOn: status === 'PAID' ? new Date() : null } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'CommissionPayout', entityId: id, summary: `Commission → ${status}` });
    revalidatePath('/pricing');
    return { ok: true, message: `Moved to ${status.toLowerCase()}.` };
  } catch (e) {
    return toActionError(e);
  }
}
