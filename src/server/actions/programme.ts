'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

export type ProgrammeResult = { ok: true; message: string; id?: string } | { error: string };
const optDate = (v?: string | null) => (v ? new Date(v) : null);

const activitySchema = z.object({
  id: z.string().optional(),
  projectId: z.string().min(1, 'Pick a project.'),
  name: z.string().min(2, 'Name the activity.').max(200),
  wbsCode: z.string().max(40).optional().nullable(),
  durationDays: z.number().int().min(1).max(3650),
  plannedStart: z.string().optional().nullable(),
  plannedEnd: z.string().optional().nullable(),
  plannedCost: z.number().nonnegative().optional(),
  actualCost: z.number().nonnegative().optional(),
  isMilestone: z.boolean().optional(),
});

export async function saveActivity(input: unknown): Promise<ProgrammeResult> {
  try {
    const ctx = await ensure('programme.manage');
    const d = activitySchema.parse(input);
    const data = {
      projectId: d.projectId, name: d.name, wbsCode: d.wbsCode ?? null,
      durationDays: d.durationDays, plannedStart: optDate(d.plannedStart), plannedEnd: optDate(d.plannedEnd),
      plannedCost: d.plannedCost ?? 0, actualCost: d.actualCost ?? 0, isMilestone: d.isMilestone ?? false,
    };
    const saved = d.id
      ? await prisma.programmeActivity.update({ where: { id: d.id }, data, select: { id: true } })
      : await prisma.programmeActivity.create({ data: { ...data, createdById: ctx.user.id }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: d.id ? 'UPDATE' : 'CREATE', entityType: 'ProgrammeActivity', entityId: saved.id, summary: `Activity "${d.name}" (${d.durationDays}d)` });
    revalidatePath('/programme');
    return { ok: true, message: d.id ? 'Activity updated.' : 'Activity added.', id: saved.id };
  } catch (e) {
    return toActionError(e);
  }
}

export async function linkActivities(input: unknown): Promise<ProgrammeResult> {
  try {
    const ctx = await ensure('programme.manage');
    const d = z.object({
      predecessorId: z.string().min(1),
      successorId: z.string().min(1),
      lagDays: z.number().int().optional(),
    }).parse(input);
    if (d.predecessorId === d.successorId) return { error: 'An activity cannot depend on itself.' };
    await prisma.activityDependency.upsert({
      where: { predecessorId_successorId: { predecessorId: d.predecessorId, successorId: d.successorId } },
      update: { lagDays: d.lagDays ?? 0 },
      create: { predecessorId: d.predecessorId, successorId: d.successorId, lagDays: d.lagDays ?? 0 },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'ActivityDependency', summary: 'Linked two activities' });
    revalidatePath('/programme');
    return { ok: true, message: 'Dependency saved.' };
  } catch (e) {
    return toActionError(e);
  }
}

export async function recordProgress(input: unknown): Promise<ProgrammeResult> {
  try {
    const ctx = await ensure('programme.manage');
    const d = z.object({
      activityId: z.string().min(1),
      percentComplete: z.number().min(0).max(100),
      note: z.string().max(500).optional().nullable(),
      photoDocumentId: z.string().optional().nullable(),
      updateDate: z.string().optional().nullable(),
    }).parse(input);
    await prisma.$transaction([
      prisma.progressUpdate.create({
        data: {
          activityId: d.activityId, percentComplete: d.percentComplete, note: d.note ?? null,
          photoDocumentId: d.photoDocumentId ?? null, recordedById: ctx.user.id,
          updateDate: optDate(d.updateDate) ?? new Date(),
        },
      }),
      prisma.programmeActivity.update({
        where: { id: d.activityId },
        data: {
          percentComplete: d.percentComplete,
          ...(d.percentComplete >= 100 ? { actualEnd: new Date() } : {}),
        },
      }),
    ]);
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'ProgrammeActivity', entityId: d.activityId, summary: `Progress ${d.percentComplete}%` });
    revalidatePath('/programme');
    return { ok: true, message: `Recorded ${d.percentComplete}%.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveDelay(input: unknown): Promise<ProgrammeResult> {
  try {
    const ctx = await ensure('programme.manage');
    const d = z.object({
      projectId: z.string().min(1),
      activityId: z.string().optional().nullable(),
      cause: z.string().min(3, 'Say what caused the delay.').max(500),
      responsibility: z.enum(['DEVELOPER', 'CONTRACTOR', 'CONSULTANT', 'AUTHORITY', 'FORCE_MAJEURE', 'OTHER']),
      days: z.number().int().min(0).max(3650),
      costImpact: z.number().nonnegative().optional().nullable(),
      occurredOn: z.string().optional().nullable(),
      note: z.string().max(1000).optional().nullable(),
    }).parse(input);
    await prisma.delayEntry.create({
      data: {
        projectId: d.projectId, activityId: d.activityId || null, cause: d.cause,
        responsibility: d.responsibility, days: d.days, costImpact: d.costImpact ?? null,
        occurredOn: optDate(d.occurredOn), note: d.note ?? null, createdById: ctx.user.id,
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'DelayEntry', summary: `Delay: ${d.days}d (${d.responsibility})` });
    revalidatePath('/programme');
    return { ok: true, message: 'Delay recorded.' };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveBoqItem(input: unknown): Promise<ProgrammeResult> {
  try {
    const ctx = await ensure('programme.manage');
    const d = z.object({
      id: z.string().optional(),
      projectId: z.string().min(1),
      code: z.string().max(40).optional().nullable(),
      description: z.string().min(2, 'Describe the item.').max(300),
      unit: z.string().max(20).optional().nullable(),
      quantity: z.number().nonnegative(),
      rate: z.number().nonnegative(),
    }).parse(input);
    const amount = Math.round(d.quantity * d.rate * 100) / 100;
    const data = { projectId: d.projectId, code: d.code ?? null, description: d.description, unit: d.unit ?? null, quantity: d.quantity, rate: d.rate, amount };
    const saved = d.id
      ? await prisma.boqItem.update({ where: { id: d.id }, data, select: { id: true } })
      : await prisma.boqItem.create({ data, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: d.id ? 'UPDATE' : 'CREATE', entityType: 'BoqItem', entityId: saved.id, summary: `BOQ: ${d.description}` });
    revalidatePath('/programme');
    return { ok: true, message: 'BOQ item saved.', id: saved.id };
  } catch (e) {
    return toActionError(e);
  }
}
