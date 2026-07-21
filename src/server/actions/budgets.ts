'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';
import { seedCostCodes } from '@/server/services/budget-service';

export type BudgetResult = { ok: true; message: string } | { error: string };

/** Create the standard cost breakdown. Safe to run again. */
export async function setUpCostCodes(): Promise<BudgetResult> {
  try {
    const ctx = await ensure('finance.ledger.manage');
    const r = await seedCostCodes();
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Setting', summary: `Cost codes: ${r.created} created` });
    revalidatePath('/budgets');
    return { ok: true, message: r.created ? `${r.created} cost codes created.` : 'Every cost code already exists.' };
  } catch (e) {
    return toActionError(e);
  }
}

const budgetSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(2).max(120),
  lines: z.array(z.object({
    costCode: z.string().min(1),
    amount: z.number().nonnegative(),
    quantity: z.number().optional().nullable(),
    unit: z.string().max(20).optional().nullable(),
    rate: z.number().optional().nullable(),
    note: z.string().max(300).optional().nullable(),
  })).min(1, 'A budget needs at least one head.'),
});

/**
 * Save a budget as a new version.
 *
 * A revision never overwrites its predecessor. "What did we originally think
 * this would cost" is the question that makes the next estimate better, and it
 * is unanswerable the moment budgets are edited in place.
 */
export async function saveBudget(input: unknown): Promise<BudgetResult> {
  try {
    const ctx = await ensure('finance.ledger.manage');
    const d = budgetSchema.parse(input);

    const codes = await prisma.costCode.findMany({
      where: { code: { in: d.lines.map((l) => l.costCode) } },
      select: { id: true, code: true, isGroup: true, name: true },
    });
    const byCode = new Map(codes.map((c) => [c.code, c]));
    for (const l of d.lines) {
      const c = byCode.get(l.costCode);
      if (!c) return { error: `There is no cost code "${l.costCode}".` };
      if (c.isGroup) return { error: `"${c.name}" is a heading. Budget the heads underneath it instead.` };
    }

    const current = await prisma.budget.findFirst({
      where: { projectId: d.projectId },
      orderBy: { version: 'desc' },
      select: { id: true, version: true, status: true },
    });

    const created = await prisma.$transaction(async (tx) => {
      const budget = await tx.budget.create({
        data: {
          projectId: d.projectId,
          name: d.name,
          version: (current?.version ?? 0) + 1,
          status: 'APPROVED',
          approvedById: ctx.user.id,
          approvedAt: new Date(),
          supersedesId: current?.id ?? null,
          createdById: ctx.user.id,
          lines: {
            create: d.lines.map((l) => ({
              costCodeId: byCode.get(l.costCode)!.id,
              amount: l.amount,
              quantity: l.quantity ?? null,
              unit: l.unit ?? null,
              rate: l.rate ?? null,
              note: l.note ?? null,
            })),
          },
        },
        select: { id: true, version: true },
      });
      if (current) {
        await tx.budget.update({ where: { id: current.id }, data: { status: 'SUPERSEDED' } });
      }
      return budget;
    });

    await writeAudit({
      actorId: ctx.user.id, action: 'CREATE', entityType: 'Budget', entityId: created.id,
      summary: `Budget "${d.name}" v${created.version} approved (${d.lines.length} heads)`,
    });
    revalidatePath('/budgets');
    return { ok: true, message: `Saved as version ${created.version}.` };
  } catch (e) {
    return toActionError(e);
  }
}

/** Write down why a head moved. Required once a variance is large and material. */
export async function explainVariance(input: {
  projectId: string; costCode: string; varianceAmount: number; variancePct: number;
  reason: string; action?: string;
}): Promise<BudgetResult> {
  try {
    const ctx = await ensure('finance.ledger.manage');
    if (!input.reason || input.reason.trim().length < 10) {
      return { error: 'Give a real reason — this is what somebody reads in a year when they ask what happened.' };
    }
    const code = await prisma.costCode.findUnique({ where: { code: input.costCode }, select: { id: true } });
    if (!code) return { error: 'That cost code no longer exists.' };

    await prisma.budgetVariance.create({
      data: {
        projectId: input.projectId, costCodeId: code.id,
        varianceAmount: input.varianceAmount, variancePct: input.variancePct,
        reason: input.reason.trim(), action: input.action?.trim() || null,
        raisedById: ctx.user.id,
      },
    });
    await writeAudit({
      actorId: ctx.user.id, action: 'CREATE', entityType: 'Budget',
      summary: `Variance explained on ${input.costCode}: ${input.reason.trim().slice(0, 120)}`,
    });
    revalidatePath('/budgets');
    return { ok: true, message: 'Recorded.' };
  } catch (e) {
    return toActionError(e);
  }
}
