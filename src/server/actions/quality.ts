'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

export type QualityResult = { ok: true; message: string; id?: string } | { error: string };
const optDate = (v?: string | null) => (v ? new Date(v) : null);

const inspectionSchema = z.object({
  id: z.string().optional(),
  projectId: z.string().min(1, 'Pick a project.'),
  activityId: z.string().optional().nullable(),
  title: z.string().min(2, 'Name the inspection.').max(200),
  discipline: z.string().max(80).optional().nullable(),
  isHoldPoint: z.boolean().optional(),
  status: z.enum(['SCHEDULED', 'PASSED', 'FAILED']).optional(),
  inspectedBy: z.string().max(160).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

export async function saveInspection(input: unknown): Promise<QualityResult> {
  try {
    const ctx = await ensure('quality.manage');
    const d = inspectionSchema.parse(input);
    const status = d.status ?? 'SCHEDULED';
    const data = {
      projectId: d.projectId, activityId: d.activityId || null, title: d.title,
      discipline: d.discipline ?? null, isHoldPoint: d.isHoldPoint ?? false, status,
      inspectedBy: d.inspectedBy ?? null, note: d.note ?? null,
      inspectedOn: status === 'SCHEDULED' ? null : new Date(),
    };
    const saved = d.id
      ? await prisma.inspection.update({ where: { id: d.id }, data, select: { id: true } })
      : await prisma.inspection.create({ data: { ...data, createdById: ctx.user.id }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: d.id ? 'UPDATE' : 'CREATE', entityType: 'Inspection', entityId: saved.id, summary: `Inspection "${d.title}" (${status}${d.isHoldPoint ? ', hold point' : ''})` });
    revalidatePath('/quality');
    return { ok: true, message: 'Inspection saved.', id: saved.id };
  } catch (e) {
    return toActionError(e);
  }
}

export async function setInspectionResult(id: string, status: 'SCHEDULED' | 'PASSED' | 'FAILED'): Promise<QualityResult> {
  try {
    const ctx = await ensure('quality.manage');
    await prisma.inspection.update({ where: { id }, data: { status, inspectedOn: status === 'SCHEDULED' ? null : new Date(), inspectedBy: status === 'SCHEDULED' ? null : (ctx.user.name ?? null) } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Inspection', entityId: id, summary: `Inspection ${status}` });
    revalidatePath('/quality');
    return { ok: true, message: `Marked ${status.toLowerCase()}.` };
  } catch (e) {
    return toActionError(e);
  }
}

const ncrSchema = z.object({
  id: z.string().optional(),
  projectId: z.string().min(1),
  title: z.string().min(2, 'Name the non-conformance.').max(200),
  description: z.string().max(2000).optional().nullable(),
  severity: z.enum(['MINOR', 'MAJOR', 'CRITICAL']),
  status: z.enum(['RAISED', 'ASSIGNED', 'RECTIFIED', 'VERIFIED', 'CLOSED']).optional(),
  assignedTo: z.string().max(160).optional().nullable(),
  costImpact: z.number().nonnegative().optional().nullable(),
});

export async function saveNcr(input: unknown): Promise<QualityResult> {
  try {
    const ctx = await ensure('quality.manage');
    const d = ncrSchema.parse(input);
    const status = d.status ?? 'RAISED';
    const data = {
      projectId: d.projectId, title: d.title, description: d.description ?? null,
      severity: d.severity, status, assignedTo: d.assignedTo ?? null,
      costImpact: d.costImpact ?? null, closedOn: status === 'CLOSED' ? new Date() : null,
    };
    const saved = d.id
      ? await prisma.nonConformance.update({ where: { id: d.id }, data, select: { id: true } })
      : await prisma.nonConformance.create({ data: { ...data, createdById: ctx.user.id }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: d.id ? 'UPDATE' : 'CREATE', entityType: 'NonConformance', entityId: saved.id, summary: `NCR "${d.title}" (${d.severity}, ${status})` });
    revalidatePath('/quality');
    return { ok: true, message: 'Non-conformance saved.', id: saved.id };
  } catch (e) {
    return toActionError(e);
  }
}

export async function advanceNcr(id: string, status: 'RAISED' | 'ASSIGNED' | 'RECTIFIED' | 'VERIFIED' | 'CLOSED'): Promise<QualityResult> {
  try {
    const ctx = await ensure('quality.manage');
    await prisma.nonConformance.update({ where: { id }, data: { status, closedOn: status === 'CLOSED' ? new Date() : null } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'NonConformance', entityId: id, summary: `NCR → ${status}` });
    revalidatePath('/quality');
    return { ok: true, message: `Moved to ${status.toLowerCase()}.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveSafetyRecord(input: unknown): Promise<QualityResult> {
  try {
    const ctx = await ensure('quality.manage');
    const d = z.object({
      projectId: z.string().min(1),
      kind: z.enum(['INCIDENT', 'NEAR_MISS', 'TOOLBOX_TALK']),
      severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
      description: z.string().min(3, 'Describe what happened.').max(2000),
      rootCause: z.string().max(1000).optional().nullable(),
      personsAffected: z.number().int().min(0).max(10000).optional(),
      occurredOn: z.string().optional().nullable(),
    }).parse(input);
    await prisma.safetyRecord.create({
      data: {
        projectId: d.projectId, kind: d.kind, severity: d.severity, description: d.description,
        rootCause: d.rootCause ?? null, personsAffected: d.personsAffected ?? 0,
        occurredOn: optDate(d.occurredOn) ?? new Date(), createdById: ctx.user.id,
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'SafetyRecord', summary: `${d.kind} (${d.severity})` });
    revalidatePath('/quality');
    return { ok: true, message: 'Safety record added.' };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveWorkPermit(input: unknown): Promise<QualityResult> {
  try {
    const ctx = await ensure('quality.manage');
    const d = z.object({
      id: z.string().optional(),
      projectId: z.string().min(1),
      type: z.enum(['HOT_WORK', 'HEIGHT', 'CONFINED_SPACE', 'LIFTING', 'ELECTRICAL', 'EXCAVATION', 'OTHER']),
      status: z.enum(['OPEN', 'CLOSED', 'EXPIRED']).optional(),
      issuedTo: z.string().min(2, 'Who is it issued to?').max(160),
      location: z.string().max(160).optional().nullable(),
      validFrom: z.string().optional().nullable(),
      validTo: z.string().optional().nullable(),
    }).parse(input);
    const status = d.status ?? 'OPEN';
    const data = {
      projectId: d.projectId, type: d.type, status, issuedTo: d.issuedTo,
      location: d.location ?? null, validFrom: optDate(d.validFrom), validTo: optDate(d.validTo),
      closedOn: status === 'CLOSED' ? new Date() : null,
    };
    const saved = d.id
      ? await prisma.workPermit.update({ where: { id: d.id }, data, select: { id: true } })
      : await prisma.workPermit.create({ data: { ...data, createdById: ctx.user.id }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: d.id ? 'UPDATE' : 'CREATE', entityType: 'WorkPermit', entityId: saved.id, summary: `Permit ${d.type} → ${d.issuedTo} (${status})` });
    revalidatePath('/quality');
    return { ok: true, message: 'Permit saved.', id: saved.id };
  } catch (e) {
    return toActionError(e);
  }
}

export async function closeWorkPermit(id: string): Promise<QualityResult> {
  try {
    const ctx = await ensure('quality.manage');
    await prisma.workPermit.update({ where: { id }, data: { status: 'CLOSED', closedOn: new Date() } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'WorkPermit', entityId: id, summary: 'Permit closed' });
    revalidatePath('/quality');
    return { ok: true, message: 'Permit closed.' };
  } catch (e) {
    return toActionError(e);
  }
}
