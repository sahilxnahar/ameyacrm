'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';
import { buildCostSheetPdf } from '@/lib/pdf/cost-sheet-pdf';
import { towerUnitCode } from '@/lib/inventory/tower-codes';

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

// ─── Master data: creating units ─────────────────────────────────────────────
//
// Until now the only way to get a unit into the system was a CSV upload. That is
// fine for the initial load of a 300-unit tower and wrong for everything after
// it: a single unit added late, a penthouse split into two, a corrected code.
// People were editing a spreadsheet and re-importing it, which is how duplicate
// and half-updated inventory gets in.

const unitSchema = z.object({
  projectId: z.string().min(1, 'Pick a project.'),
  code: z.string().min(1, 'Give the unit a code.').max(40),
  tower: z.string().max(40).optional().or(z.literal('')),
  floor: z.coerce.number().int().min(-5).max(200).optional(),
  typology: z.string().max(40).optional().or(z.literal('')),
  facing: z.string().max(20).optional().or(z.literal('')),
  carpetAreaSqft: z.coerce.number().nonnegative().max(1_000_000).optional(),
  price: z.coerce.number().nonnegative().max(10_000_000_000).optional(),
});

/** Add one unit by hand. */
export async function createUnit(input: unknown): Promise<InvResult> {
  try {
    const ctx = await ensure('booking.manage');
    const d = unitSchema.parse(input);
    const code = d.code.trim().toUpperCase();

    const project = await prisma.project.findUnique({ where: { id: d.projectId }, select: { id: true, name: true } });
    if (!project) return { error: 'That project no longer exists.' };

    // The unique index would catch this, but a Prisma constraint error reads
    // like a bug to the person typing; the code is the thing they can fix.
    const clash = await prisma.unit.findFirst({ where: { projectId: d.projectId, code }, select: { id: true } });
    if (clash) return { error: `${project.name} already has a unit ${code}.` };

    const unit = await prisma.unit.create({
      data: {
        projectId: d.projectId, code,
        tower: d.tower?.trim() || null,
        floor: d.floor ?? null,
        typology: d.typology?.trim() || null,
        facing: d.facing?.trim() || null,
        carpetAreaSqft: d.carpetAreaSqft ?? null,
        price: d.price ?? null,
      },
      select: { id: true },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Unit', entityId: unit.id, summary: `Added unit ${code} to ${project.name}` });
    revalidatePath('/inventory');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

const towerSchema = z.object({
  projectId: z.string().min(1, 'Pick a project.'),
  tower: z.string().min(1, 'Name the tower.').max(40),
  fromFloor: z.coerce.number().int().min(-5).max(200),
  toFloor: z.coerce.number().int().min(-5).max(200),
  unitsPerFloor: z.coerce.number().int().min(1).max(26),
  /** "{tower}-{floor}{unit:02}" style is implied; this is the separator only. */
  numbering: z.enum(['NUMERIC', 'ALPHA']).default('NUMERIC'),
  startAt: z.coerce.number().int().min(1).max(99).default(1),
  typology: z.string().max(40).optional().or(z.literal('')),
  carpetAreaSqft: z.coerce.number().nonnegative().max(1_000_000).optional(),
  price: z.coerce.number().nonnegative().max(10_000_000_000).optional(),
});

export interface TowerResult { ok: true; created: number; skipped: number; message: string }

/**
 * Generate a whole tower at once: floors × units per floor.
 *
 * This is the shape real inventory actually arrives in, and doing it by hand is
 * hundreds of near-identical rows. Existing codes are skipped rather than
 * overwritten, so running it again after adding two floors adds only those two
 * — re-running is safe, which matters because people will.
 */
export async function createTower(input: unknown): Promise<TowerResult | { error: string }> {
  try {
    const ctx = await ensure('booking.manage');
    const d = towerSchema.parse(input);
    if (d.toFloor < d.fromFloor) return { error: 'The top floor has to be at or above the bottom floor.' };

    const project = await prisma.project.findUnique({ where: { id: d.projectId }, select: { id: true, name: true } });
    if (!project) return { error: 'That project no longer exists.' };

    const tower = d.tower.trim().toUpperCase();
    const floors = d.toFloor - d.fromFloor + 1;
    const total = floors * d.unitsPerFloor;
    // A slip of the keyboard on "to floor" should not create ten thousand units.
    if (total > 2000) return { error: `That would create ${total.toLocaleString('en-IN')} units. Do it in smaller blocks — 2,000 at a time is the limit.` };

    const wanted: { code: string; floor: number }[] = [];
    for (let f = d.fromFloor; f <= d.toFloor; f++) {
      for (let i = 0; i < d.unitsPerFloor; i++) {
        wanted.push({ code: towerUnitCode(tower, f, i, d.numbering, d.startAt), floor: f });
      }
    }

    const existing = new Set(
      (await prisma.unit.findMany({
        where: { projectId: d.projectId, code: { in: wanted.map((w) => w.code) } },
        select: { code: true },
      })).map((u) => u.code),
    );
    const fresh = wanted.filter((w) => !existing.has(w.code));
    if (fresh.length === 0) return { error: `Every one of those ${total} units already exists in ${project.name}.` };

    await prisma.unit.createMany({
      data: fresh.map((w) => ({
        projectId: d.projectId, code: w.code, tower, floor: w.floor,
        typology: d.typology?.trim() || null,
        carpetAreaSqft: d.carpetAreaSqft ?? null,
        price: d.price ?? null,
      })),
      skipDuplicates: true,
    });

    await writeAudit({
      actorId: ctx.user.id, action: 'CREATE', entityType: 'Unit', entityId: d.projectId,
      summary: `Generated tower ${tower} in ${project.name} — ${fresh.length} unit${fresh.length === 1 ? '' : 's'} (floors ${d.fromFloor}–${d.toFloor})`,
    });
    revalidatePath('/inventory');
    return {
      ok: true, created: fresh.length, skipped: existing.size,
      message: `Tower ${tower}: ${fresh.length} unit${fresh.length === 1 ? '' : 's'} created${existing.size ? `, ${existing.size} already existed and were left alone` : ''}.`,
    };
  } catch (e) { return toActionError(e) as { error: string }; }
}

/** Correct a unit's details. Status is changed through setUnitStatus, not here. */
export async function updateUnit(input: unknown): Promise<InvResult> {
  try {
    const ctx = await ensure('booking.manage');
    const d = unitSchema.extend({ unitId: z.string().min(1) }).parse(input);
    const code = d.code.trim().toUpperCase();
    const unit = await prisma.unit.findUnique({ where: { id: d.unitId }, select: { id: true, code: true, projectId: true } });
    if (!unit) return { error: 'That unit no longer exists.' };

    if (code !== unit.code) {
      const clash = await prisma.unit.findFirst({ where: { projectId: unit.projectId, code, id: { not: unit.id } }, select: { id: true } });
      if (clash) return { error: `Another unit in this project is already called ${code}.` };
    }

    await prisma.unit.update({
      where: { id: d.unitId },
      data: {
        code,
        tower: d.tower?.trim() || null,
        floor: d.floor ?? null,
        typology: d.typology?.trim() || null,
        facing: d.facing?.trim() || null,
        carpetAreaSqft: d.carpetAreaSqft ?? null,
        price: d.price ?? null,
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Unit', entityId: d.unitId, summary: `Updated unit ${code}` });
    revalidatePath('/inventory');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}
