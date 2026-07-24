'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { PARKING_TYPES, PARKING_STATUSES } from '@/lib/parking/types';
import { getParkingData, type ParkingData } from '@/server/services/parking-service';
import { ensure, toActionError } from './_helpers';

export type ParkingResult = { ok: true; id?: string } | { error: string };

export async function parkingForProject(projectId: string): Promise<{ ok: true; data: ParkingData } | { error: string }> {
  try {
    await ensure('booking.view');
    return { ok: true, data: await getParkingData(projectId) };
  } catch (e) { return toActionError(e); }
}

const slotSchema = z.object({
  projectId: z.string().min(1, 'Choose a project'),
  code: z.string().min(1, 'Slot code is required').max(40),
  level: z.string().max(60).optional(),
  type: z.enum(PARKING_TYPES),
  notes: z.string().max(300).optional(),
});

export async function createParkingSlot(input: unknown): Promise<ParkingResult> {
  try {
    const ctx = await ensure('booking.manage');
    const d = slotSchema.parse(input);
    const exists = await prisma.parkingSlot.findUnique({ where: { code: d.code.trim() }, select: { id: true } });
    if (exists) return { error: `A parking slot “${d.code.trim()}” already exists.` };
    const s = await prisma.parkingSlot.create({ data: { projectId: d.projectId, code: d.code.trim(), level: d.level?.trim() || null, type: d.type, notes: d.notes || null } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'ParkingSlot', entityId: s.id, summary: `Parking slot ${d.code}` });
    revalidatePath('/parking');
    return { ok: true, id: s.id };
  } catch (e) { return toActionError(e); }
}

const bulkSchema = z.object({
  projectId: z.string().min(1, 'Choose a project'),
  level: z.string().max(60).optional(),
  type: z.enum(PARKING_TYPES),
  prefix: z.string().max(30).default(''),
  start: z.coerce.number().int().min(0).default(1),
  count: z.coerce.number().int().min(1).max(500),
  pad: z.coerce.number().int().min(0).max(6).default(0),
});

/** Generate a run of slots in one go, e.g. B1-001 … B1-120. Skips codes that exist. */
export async function bulkCreateParkingSlots(input: unknown): Promise<ParkingResult & { created?: number }> {
  try {
    const ctx = await ensure('booking.manage');
    const d = bulkSchema.parse(input);
    const codes: string[] = [];
    for (let i = 0; i < d.count; i++) {
      const num = d.start + i;
      codes.push(`${d.prefix}${d.pad > 0 ? String(num).padStart(d.pad, '0') : num}`);
    }
    const existing = new Set((await prisma.parkingSlot.findMany({ where: { code: { in: codes } }, select: { code: true } })).map((s) => s.code));
    const fresh = codes.filter((c) => !existing.has(c));
    if (fresh.length === 0) return { error: 'Every slot code in that range already exists.' };
    await prisma.parkingSlot.createMany({ data: fresh.map((code) => ({ projectId: d.projectId, code, level: d.level?.trim() || null, type: d.type })) });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'ParkingSlot', entityId: 'bulk', summary: `Bulk-created ${fresh.length} parking slots` });
    revalidatePath('/parking');
    return { ok: true, created: fresh.length };
  } catch (e) { return toActionError(e); }
}

export async function assignParkingSlot(slotId: string, unitId: string | null): Promise<ParkingResult> {
  try {
    const ctx = await ensure('booking.manage');
    const slot = await prisma.parkingSlot.findUnique({ where: { id: slotId }, select: { code: true } });
    if (!slot) return { error: 'Slot not found.' };
    if (unitId) {
      const unit = await prisma.unit.findUnique({ where: { id: unitId }, select: { id: true } });
      if (!unit) return { error: 'Unit not found.' };
      await prisma.parkingSlot.update({ where: { id: slotId }, data: { unitId, status: 'Assigned' } });
    } else {
      await prisma.parkingSlot.update({ where: { id: slotId }, data: { unitId: null, bookingId: null, status: 'Available' } });
    }
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'ParkingSlot', entityId: slotId, summary: unitId ? `Assigned slot ${slot.code}` : `Freed slot ${slot.code}` });
    revalidatePath('/parking');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

export async function setParkingStatus(slotId: string, status: string): Promise<ParkingResult> {
  try {
    const ctx = await ensure('booking.manage');
    if (!(PARKING_STATUSES as readonly string[]).includes(status)) return { error: 'Unknown status.' };
    const slot = await prisma.parkingSlot.findUnique({ where: { id: slotId }, select: { code: true } });
    if (!slot) return { error: 'Slot not found.' };
    const data: { status: string; unitId?: null; bookingId?: null } = { status };
    if (status !== 'Assigned') { data.unitId = null; data.bookingId = null; }
    await prisma.parkingSlot.update({ where: { id: slotId }, data });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'ParkingSlot', entityId: slotId, summary: `Slot ${slot.code} → ${status}` });
    revalidatePath('/parking');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

export async function deleteParkingSlot(slotId: string): Promise<ParkingResult> {
  try {
    const ctx = await ensure('booking.manage');
    const slot = await prisma.parkingSlot.findUnique({ where: { id: slotId }, select: { code: true } });
    if (!slot) return { error: 'Slot not found.' };
    await prisma.parkingSlot.delete({ where: { id: slotId } });
    await writeAudit({ actorId: ctx.user.id, action: 'DELETE', entityType: 'ParkingSlot', entityId: slotId, summary: `Deleted parking slot ${slot.code}` });
    revalidatePath('/parking');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}
