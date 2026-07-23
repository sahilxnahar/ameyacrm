'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';
import { escrowPosition, canWithdraw, type EscrowMovementInput } from '@/lib/capital/escrow';
import { capitalOverview } from '@/server/services/capital-service';
import { getCompanyDetails } from '@/server/services/company-service';
import { buildReraCompliancePdf } from '@/lib/pdf/rera-compliance-pdf';

export type CapitalResult = { ok: true; message: string; id?: string } | { error: string };
const num = (d: unknown): number => (d == null ? 0 : Number(d));

/** Generate the RERA 70:30 escrow compliance statement (PDF) for a project. */
export async function generateReraComplianceReport(projectId: string | null): Promise<{ ok: true; filename: string; pdfBase64: string } | { error: string }> {
  try {
    const ctx = await ensure('capital.view');
    const [overview, company, project] = await Promise.all([
      capitalOverview(projectId),
      getCompanyDetails(),
      projectId ? prisma.project.findUnique({ where: { id: projectId }, select: { name: true, reraNumber: true } }) : Promise.resolve(null),
    ]);
    const bytes = await buildReraCompliancePdf({
      company: {
        name: company.legalName, registeredAddress: company.registeredAddress,
        phone: company.phone, email: company.email, website: company.website, gstin: company.gstin,
      },
      projectName: project?.name ?? 'All projects',
      reraNumber: project?.reraNumber ?? null,
      asOf: new Date(),
      escrow: overview.escrow,
      certifiedPct: overview.latestCertifiedPct,
    });
    await writeAudit({ actorId: ctx.user.id, action: 'EXPORT', entityType: 'Project', entityId: projectId ?? undefined, summary: `Generated RERA escrow compliance statement${project?.name ? ` for ${project.name}` : ''}` });
    const safe = (project?.name ?? 'all-projects').replace(/[^a-z0-9]+/gi, '-');
    return { ok: true, filename: `RERA-Escrow-Compliance-${safe}.pdf`, pdfBase64: Buffer.from(bytes).toString('base64') };
  } catch (err) { return toActionError(err); }
}

export async function saveInvestor(input: unknown): Promise<CapitalResult> {
  try {
    const ctx = await ensure('capital.manage');
    const d = z.object({
      id: z.string().optional(),
      projectId: z.string().optional().nullable(),
      name: z.string().min(2, 'Name the investor.').max(160),
      contact: z.string().max(200).optional().nullable(),
      commitment: z.number().nonnegative().optional(),
      notes: z.string().max(1000).optional().nullable(),
    }).parse(input);
    const data = { projectId: d.projectId ?? null, name: d.name, contact: d.contact ?? null, commitment: d.commitment ?? 0, notes: d.notes ?? null };
    const saved = d.id
      ? await prisma.investor.update({ where: { id: d.id }, data, select: { id: true } })
      : await prisma.investor.create({ data: { ...data, createdById: ctx.user.id }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: d.id ? 'UPDATE' : 'CREATE', entityType: 'Investor', entityId: saved.id, summary: `Investor "${d.name}"` });
    revalidatePath('/capital');
    return { ok: true, message: 'Investor saved.', id: saved.id };
  } catch (e) {
    return toActionError(e);
  }
}

export async function addInvestorTransaction(input: unknown): Promise<CapitalResult> {
  try {
    const ctx = await ensure('capital.manage');
    const d = z.object({
      investorId: z.string().min(1),
      kind: z.enum(['COMMITMENT', 'DRAWDOWN', 'DISTRIBUTION', 'REPAYMENT']),
      amount: z.number().positive('Enter an amount.'),
      unitsAllotted: z.number().int().min(0).optional().nullable(),
      txnDate: z.string().optional().nullable(),
      note: z.string().max(300).optional().nullable(),
    }).parse(input);
    await prisma.investorTransaction.create({
      data: { investorId: d.investorId, kind: d.kind, amount: d.amount, unitsAllotted: d.unitsAllotted ?? null, txnDate: d.txnDate ? new Date(d.txnDate) : new Date(), note: d.note ?? null },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Investor', entityId: d.investorId, summary: `${d.kind} ${d.amount}` });
    revalidatePath('/capital');
    return { ok: true, message: `${d.kind.toLowerCase()} recorded.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveCapitalEntry(input: unknown): Promise<CapitalResult> {
  try {
    const ctx = await ensure('capital.manage');
    const d = z.object({
      id: z.string().optional(),
      projectId: z.string().min(1),
      kind: z.enum(['EQUITY', 'DEBT', 'BUYER_ADVANCE', 'MEZZANINE', 'OTHER']),
      source: z.string().min(2, 'Name the source.').max(160),
      amount: z.number().nonnegative(),
      costPct: z.number().nonnegative().max(100).optional().nullable(),
    }).parse(input);
    const data = { projectId: d.projectId, kind: d.kind, source: d.source, amount: d.amount, costPct: d.costPct ?? null };
    const saved = d.id
      ? await prisma.capitalStackEntry.update({ where: { id: d.id }, data, select: { id: true } })
      : await prisma.capitalStackEntry.create({ data, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: d.id ? 'UPDATE' : 'CREATE', entityType: 'CapitalStackEntry', entityId: saved.id, summary: `Capital: ${d.kind} ${d.source}` });
    revalidatePath('/capital');
    return { ok: true, message: 'Capital entry saved.', id: saved.id };
  } catch (e) {
    return toActionError(e);
  }
}

const escrowSchema = z.object({
  projectId: z.string().min(1),
  kind: z.enum(['DEPOSIT', 'WITHDRAWAL']),
  amount: z.number().positive('Enter a positive amount.'),
  certifiedPct: z.number().min(0).max(100).optional().nullable(),
  reference: z.string().max(120).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  movementDate: z.string().optional().nullable(),
});

/**
 * Record a movement on the RERA escrow account. A withdrawal is checked against
 * the certified-progress entitlement *before* it is written — the regulatory
 * rule is enforced here, not left to a person to remember.
 */
export async function recordEscrowMovement(input: unknown): Promise<CapitalResult> {
  try {
    const ctx = await ensure('capital.manage');
    const d = escrowSchema.parse(input);

    if (d.kind === 'WITHDRAWAL') {
      if (d.certifiedPct == null) return { error: 'A withdrawal must record the certified progress percentage it is drawn against.' };
      const [existing, receiptRows] = await Promise.all([
        prisma.escrowMovement.findMany({ where: { projectId: d.projectId }, select: { kind: true, amount: true } }),
        prisma.voucher.findMany({ where: { status: 'POSTED', kind: { in: ['CASH_RECEIVED', 'BANK_RECEIVED'] }, projectId: d.projectId }, select: { amount: true } }),
      ]);
      const receipts = receiptRows.reduce((s, v) => s + num(v.amount), 0);
      const movements: EscrowMovementInput[] = existing.map((m) => ({ kind: m.kind, amount: num(m.amount) }));
      const pos = escrowPosition(receipts, movements, d.certifiedPct);
      const check = canWithdraw(pos, d.amount);
      if (!check.ok) return { error: check.reason ?? 'Withdrawal not permitted.' };
    }

    await prisma.escrowMovement.create({
      data: {
        projectId: d.projectId, kind: d.kind, amount: d.amount, certifiedPct: d.certifiedPct ?? null,
        reference: d.reference ?? null, note: d.note ?? null,
        movementDate: d.movementDate ? new Date(d.movementDate) : new Date(), createdById: ctx.user.id,
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'EscrowMovement', summary: `Escrow ${d.kind} ${d.amount}${d.certifiedPct != null ? ` @ ${d.certifiedPct}% certified` : ''}` });
    revalidatePath('/capital');
    return { ok: true, message: `Escrow ${d.kind.toLowerCase()} recorded.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function saveCovenant(input: unknown): Promise<CapitalResult> {
  try {
    const ctx = await ensure('capital.manage');
    const d = z.object({
      id: z.string().optional(),
      projectId: z.string().optional().nullable(),
      loanRef: z.string().max(120).optional().nullable(),
      name: z.string().min(2, 'Name the covenant.').max(160),
      direction: z.enum(['MIN', 'MAX']),
      threshold: z.number(),
      current: z.number(),
      unit: z.string().max(20).optional().nullable(),
    }).parse(input);
    const data = { projectId: d.projectId ?? null, loanRef: d.loanRef ?? null, name: d.name, direction: d.direction, threshold: d.threshold, current: d.current, unit: d.unit ?? null };
    const saved = d.id
      ? await prisma.loanCovenant.update({ where: { id: d.id }, data, select: { id: true } })
      : await prisma.loanCovenant.create({ data: { ...data, createdById: ctx.user.id }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: d.id ? 'UPDATE' : 'CREATE', entityType: 'LoanCovenant', entityId: saved.id, summary: `Covenant "${d.name}" ${d.direction} ${d.threshold}` });
    revalidatePath('/capital');
    return { ok: true, message: 'Covenant saved.', id: saved.id };
  } catch (e) {
    return toActionError(e);
  }
}
