'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

export type FeasResult = { ok: true; message: string; id?: string } | { error: string };

const schema = z.object({
  id: z.string().optional(),
  projectId: z.string().optional().nullable(),
  name: z.string().min(2, 'Name the appraisal.').max(160),
  landCost: z.number().nonnegative().optional(),
  constructionCost: z.number().nonnegative().optional(),
  financeCost: z.number().nonnegative().optional(),
  otherCost: z.number().nonnegative().optional(),
  saleableAreaSqft: z.number().nonnegative().optional(),
  salePricePerSqft: z.number().nonnegative().optional(),
  targetReturnPct: z.number().nonnegative().max(1000).optional().nullable(),
  salePriceDeltaPct: z.number().optional(),
  costDeltaPct: z.number().optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function saveFeasibility(input: unknown): Promise<FeasResult> {
  try {
    const ctx = await ensure('feasibility.manage');
    const d = schema.parse(input);
    const data = {
      projectId: d.projectId ?? null, name: d.name,
      landCost: d.landCost ?? 0, constructionCost: d.constructionCost ?? 0, financeCost: d.financeCost ?? 0,
      otherCost: d.otherCost ?? 0, saleableAreaSqft: d.saleableAreaSqft ?? 0, salePricePerSqft: d.salePricePerSqft ?? 0,
      targetReturnPct: d.targetReturnPct ?? null, salePriceDeltaPct: d.salePriceDeltaPct ?? 0, costDeltaPct: d.costDeltaPct ?? 0,
      notes: d.notes ?? null,
    };
    const saved = d.id
      ? await prisma.feasibilityModel.update({ where: { id: d.id }, data, select: { id: true } })
      : await prisma.feasibilityModel.create({ data: { ...data, createdById: ctx.user.id }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: d.id ? 'UPDATE' : 'CREATE', entityType: 'FeasibilityModel', entityId: saved.id, summary: `Appraisal "${d.name}"` });
    revalidatePath('/feasibility');
    return { ok: true, message: 'Appraisal saved.', id: saved.id };
  } catch (e) {
    return toActionError(e);
  }
}
