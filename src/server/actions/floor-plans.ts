'use server';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { PLAN_KINDS } from '@/config/floor-plans';

export type PlanResult = { ok: true; id?: string } | { error: string };

const planSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(120),
  kind: z.enum(PLAN_KINDS).default('FLOOR'),
  description: z.string().max(300).optional().or(z.literal('')),
  tower: z.string().max(40).optional().or(z.literal('')),
  floor: z.coerce.number().int().optional().nullable(),
  imageUrl: z.string().min(4),
  imageWidth: z.coerce.number().int().positive().default(1000),
  imageHeight: z.coerce.number().int().positive().default(700),
});

export async function createFloorPlan(input: unknown): Promise<PlanResult> {
  try {
    const ctx = await ensure('booking.manage');
    const d = planSchema.parse(input);
    const plan = await prisma.floorPlan.create({
      data: {
        projectId: d.projectId, name: d.name, tower: d.tower || null,
        kind: d.kind, description: d.description || null,
        floor: d.floor ?? null, imageUrl: d.imageUrl,
        imageWidth: d.imageWidth, imageHeight: d.imageHeight,
        createdById: ctx.user.id,
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Project', entityId: d.projectId, summary: `Added floor plan ${d.name}` });
    revalidatePath('/floor-plans');
    return { ok: true, id: plan.id };
  } catch (err) { return toActionError(err); }
}

export async function deleteFloorPlan(id: string): Promise<PlanResult> {
  try {
    const ctx = await ensure('booking.manage');
    await prisma.floorPlan.delete({ where: { id } });
    await writeAudit({ actorId: ctx.user.id, action: 'DELETE', entityType: 'Project', entityId: id, summary: 'Removed a floor plan' });
    revalidatePath('/floor-plans');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Save every pin for a plan in one go — the editor works on the whole layout. */
export async function savePins(
  floorPlanId: string,
  pins: Array<{ unitId: string; x: number; y: number; w: number; h: number }>,
): Promise<PlanResult> {
  try {
    const ctx = await ensure('booking.manage');
    const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number(n) || 0));
    await prisma.unitPin.deleteMany({ where: { floorPlanId } });
    if (pins.length) {
      await prisma.unitPin.createMany({
        data: pins.slice(0, 400).map((p) => ({
          floorPlanId, unitId: p.unitId,
          x: clamp(p.x, 0, 100), y: clamp(p.y, 0, 100),
          w: clamp(p.w, 1, 100), h: clamp(p.h, 1, 100),
        })),
        skipDuplicates: true,
      });
    }
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Project', entityId: floorPlanId, summary: `Placed ${pins.length} units on a plan` });
    revalidatePath('/floor-plans');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/**
 * Turn sharing on or off for a plan. A shared plan is viewable by anyone with
 * the link and shows availability but no prices — enough for a buyer to point
 * at a flat, not enough to leak your rate card.
 */
export async function toggleShare(id: string, isPublic: boolean): Promise<PlanResult> {
  try {
    const ctx = await ensure('booking.manage');
    const plan = await prisma.floorPlan.findUnique({ where: { id }, select: { shareToken: true } });
    await prisma.floorPlan.update({
      where: { id },
      data: { isPublic, shareToken: isPublic ? plan?.shareToken ?? randomBytes(16).toString('hex') : plan?.shareToken },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Project', entityId: id, summary: isPublic ? 'Shared a floor plan publicly' : 'Stopped sharing a floor plan' });
    revalidatePath('/floor-plans');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}
