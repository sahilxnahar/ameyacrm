'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import type { HomeLoanStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { getActiveProject } from '@/server/services/active-project-service';
import { ensure, toActionError } from './_helpers';

export type LoanResult = { ok: true; id?: string } | { error: string };

const STATUSES = ['ENQUIRY', 'APPLIED', 'SANCTIONED', 'DISBURSED_PARTIAL', 'DISBURSED_FULL', 'REJECTED'] as const;

const createSchema = z.object({
  buyerName: z.string().min(2, 'Buyer name is required').max(160),
  bankName: z.string().min(2, 'Bank is required').max(120),
  customerId: z.string().optional().nullable(),
  bookingId: z.string().optional().nullable(),
  applicationRef: z.string().max(80).optional(),
  loanAmount: z.coerce.number().nonnegative().default(0),
  status: z.enum(STATUSES).default('ENQUIRY'),
  notes: z.string().max(1000).optional(),
});

export async function createHomeLoan(input: unknown): Promise<LoanResult> {
  try {
    const ctx = await ensure('booking.manage');
    const d = createSchema.parse(input);
    const active = await getActiveProject(ctx.user.id);
    const loan = await prisma.homeLoan.create({
      data: {
        buyerName: d.buyerName, bankName: d.bankName,
        customerId: d.customerId || null, bookingId: d.bookingId || null,
        applicationRef: d.applicationRef || null, loanAmount: d.loanAmount,
        status: d.status, notes: d.notes || null,
        projectId: active.id ?? null, createdById: ctx.user.id,
      },
      select: { id: true },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'HomeLoan', entityId: loan.id, summary: `Home loan for ${d.buyerName} (${d.bankName})` });
    revalidatePath('/home-loans');
    return { ok: true, id: loan.id };
  } catch (e) { return toActionError(e); }
}

const updateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(STATUSES).optional(),
  sanctionedAmount: z.coerce.number().nonnegative().optional().nullable(),
  disbursedAmount: z.coerce.number().nonnegative().optional().nullable(),
  nocIssued: z.boolean().optional(),
  tripartiteSigned: z.boolean().optional(),
  applicationRef: z.string().max(80).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function updateHomeLoan(input: unknown): Promise<LoanResult> {
  try {
    const ctx = await ensure('booking.manage');
    const d = updateSchema.parse(input);
    const data: Record<string, unknown> = {};
    if (d.status) { data.status = d.status as HomeLoanStatus; if (d.status === 'SANCTIONED') data.sanctionDate = new Date(); }
    if (d.sanctionedAmount !== undefined) data.sanctionedAmount = d.sanctionedAmount;
    if (d.disbursedAmount !== undefined) data.disbursedAmount = d.disbursedAmount ?? 0;
    if (d.nocIssued !== undefined) data.nocIssued = d.nocIssued;
    if (d.tripartiteSigned !== undefined) data.tripartiteSigned = d.tripartiteSigned;
    if (d.applicationRef !== undefined) data.applicationRef = d.applicationRef || null;
    if (d.notes !== undefined) data.notes = d.notes || null;
    if (Object.keys(data).length === 0) return { ok: true, id: d.id };
    await prisma.homeLoan.update({ where: { id: d.id }, data });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'HomeLoan', entityId: d.id, summary: 'Updated home loan' });
    revalidatePath('/home-loans');
    return { ok: true, id: d.id };
  } catch (e) { return toActionError(e); }
}

export async function deleteHomeLoan(id: string): Promise<LoanResult> {
  try {
    const ctx = await ensure('booking.manage');
    await prisma.homeLoan.delete({ where: { id } });
    await writeAudit({ actorId: ctx.user.id, action: 'DELETE', entityType: 'HomeLoan', entityId: id, summary: 'Deleted home loan' });
    revalidatePath('/home-loans');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}
