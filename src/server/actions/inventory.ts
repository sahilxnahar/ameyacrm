'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';
import { buildCostSheetPdf } from '@/lib/pdf/cost-sheet-pdf';

export type InvResult = { ok: true } | { error: string };
const CLEAR = { holdUntil: null, heldForLeadId: null, heldById: null, tokenAmount: null, holdNote: null };

const blockSchema = z.object({
  unitId: z.string().min(1),
  leadId: z.string().optional().nullable(),
  tokenAmount: z.coerce.number().nonnegative().optional(),
  hours: z.coerce.number().int().min(1).max(168).default(48),
  note: z.string().max(300).optional(),
});
export async function blockUnit(input: unknown): Promise<InvResult> {
  try {
    const ctx = await ensure('booking.manage');
    const d = blockSchema.parse(input);
    const unit = await prisma.unit.findUnique({ where: { id: d.unitId } });
    if (!unit) return { error: 'Unit not found.' };
    if (unit.status === 'SOLD' || unit.status === 'BOOKED') return { error: `Unit ${unit.code} is ${unit.status.toLowerCase()} and cannot be blocked.` };
    const holdUntil = new Date(Date.now() + d.hours * 3600_000);
    await prisma.unit.update({ where: { id: d.unitId }, data: { status: 'HELD', holdUntil, heldForLeadId: d.leadId || null, heldById: ctx.user.id, tokenAmount: d.tokenAmount ?? null, holdNote: d.note || null } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Unit', entityId: d.unitId, summary: `Blocked ${unit.code} for ${d.hours}h` });
    revalidatePath('/inventory');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function releaseUnit(unitId: string): Promise<InvResult> {
  try {
    const ctx = await ensure('booking.manage');
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) return { error: 'Unit not found.' };
    await prisma.unit.update({ where: { id: unitId }, data: { status: 'AVAILABLE', ...CLEAR } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Unit', entityId: unitId, summary: `Released ${unit.code}` });
    revalidatePath('/inventory');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

const statusSchema = z.object({ unitId: z.string().min(1), status: z.enum(['AVAILABLE', 'HELD', 'BOOKED', 'SOLD', 'BLOCKED']) });
export async function setUnitStatus(input: unknown): Promise<InvResult> {
  try {
    const ctx = await ensure('booking.manage');
    const d = statusSchema.parse(input);
    const unit = await prisma.unit.findUnique({ where: { id: d.unitId } });
    if (!unit) return { error: 'Unit not found.' };
    await prisma.unit.update({ where: { id: d.unitId }, data: { status: d.status, ...(d.status === 'AVAILABLE' ? CLEAR : {}) } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Unit', entityId: d.unitId, summary: `${unit.code} → ${d.status}` });
    revalidatePath('/inventory');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

const lineSchema = z.object({ label: z.string().min(1).max(60), amount: z.coerce.number() });
const costSheetSchema = z.object({
  unitId: z.string().min(1),
  clientName: z.string().max(120).optional(),
  basePrice: z.coerce.number().nonnegative(),
  extras: z.array(lineSchema).default([]),
  gstPercent: z.coerce.number().min(0).max(28).default(5),
  otherCharges: z.array(lineSchema).default([]),
});
export async function generateCostSheet(input: unknown): Promise<{ ok: true; filename: string; pdfBase64: string } | { error: string }> {
  try {
    const ctx = await ensure('booking.view');
    const d = costSheetSchema.parse(input);
    const unit = await prisma.unit.findUnique({ where: { id: d.unitId }, include: { project: true } });
    if (!unit) return { error: 'Unit not found.' };
    const carpet = unit.carpetAreaSqft ? Number(unit.carpetAreaSqft) : null;
    const bytes = await buildCostSheetPdf({
      company: { name: 'Ameya Heights', tagline: 'Premium Residences, Bengaluru', reraNote: unit.project.reraNumber ? `RERA: ${unit.project.reraNumber}` : '' },
      project: unit.project.name, unitCode: unit.code, typology: unit.typology, tower: unit.tower, floor: unit.floor,
      facing: unit.facing, carpetAreaSqft: carpet, clientName: d.clientName || null,
      ratePerSqft: carpet && carpet > 0 ? d.basePrice / carpet : null,
      basePrice: d.basePrice, extras: d.extras, gstPercent: d.gstPercent, otherCharges: d.otherCharges,
      preparedBy: ctx.user.name, date: new Date(),
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Unit', entityId: unit.id, summary: `Generated cost sheet for ${unit.code}` });
    return { ok: true, filename: `CostSheet-${unit.code}.pdf`, pdfBase64: Buffer.from(bytes).toString('base64') };
  } catch (err) { return toActionError(err); }
}
