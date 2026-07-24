'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';
import { parseStatementCsv } from '@/lib/treasury/reconcile';

export type TreasuryResult = { ok: true; message: string; id?: string } | { error: string };

// ── Bank accounts ────────────────────────────────────────────────────────────
const accountSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Name the account.').max(120),
  bankName: z.string().min(2, 'Which bank?').max(120),
  accountLast4: z.string().max(4).optional().nullable(),
  ifsc: z.string().max(15).optional().nullable(),
  openingBalance: z.number().optional(),
  projectId: z.string().optional().nullable(),
});

export async function saveBankAccount(input: unknown): Promise<TreasuryResult> {
  try {
    const ctx = await ensure('treasury.manage');
    const d = accountSchema.parse(input);
    const data = {
      name: d.name, bankName: d.bankName,
      accountLast4: d.accountLast4?.trim() || null,
      ifsc: d.ifsc?.trim() || null,
      openingBalance: d.openingBalance ?? 0,
      projectId: d.projectId ?? null,
    };
    const saved = d.id
      ? await prisma.bankAccount.update({ where: { id: d.id }, data, select: { id: true } })
      : await prisma.bankAccount.create({ data: { ...data, createdById: ctx.user.id }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: d.id ? 'UPDATE' : 'CREATE', entityType: 'BankAccount', entityId: saved.id, summary: `Bank account "${d.name}" (${d.bankName})` });
    revalidatePath('/treasury');
    return { ok: true, message: d.id ? 'Account updated.' : 'Account added.', id: saved.id };
  } catch (e) {
    return toActionError(e);
  }
}

// ── Statement import ─────────────────────────────────────────────────────────
export async function importStatement(input: unknown): Promise<TreasuryResult> {
  try {
    const ctx = await ensure('treasury.manage');
    const d = z.object({
      bankAccountId: z.string().min(1),
      fileName: z.string().max(200).optional().nullable(),
      csv: z.string().min(1, 'Paste or upload the statement first.').max(2_000_000),
    }).parse(input);

    const account = await prisma.bankAccount.findUnique({ where: { id: d.bankAccountId }, select: { id: true } });
    if (!account) return { error: 'That bank account no longer exists.' };

    const parsed = parseStatementCsv(d.csv);
    if (parsed.lines.length === 0) {
      return { error: `No usable rows found. ${parsed.skipped.length ? `${parsed.skipped.length} rows were skipped — check the date and amount columns.` : 'Check that the file has Date and Amount (or Debit/Credit) columns.'}` };
    }

    const imp = await prisma.$transaction(async (tx) => {
      const created = await tx.bankStatementImport.create({
        data: {
          bankAccountId: d.bankAccountId,
          fileName: d.fileName ?? null,
          rowCount: parsed.lines.length,
          skippedCount: parsed.skipped.length,
          importedById: ctx.user.id,
        },
        select: { id: true },
      });
      await tx.bankStatementLine.createMany({
        data: parsed.lines.map((l) => ({
          importId: created.id,
          bankAccountId: d.bankAccountId,
          txnDate: l.date ?? new Date(),
          description: l.description || '(no narration)',
          refNo: l.refNo,
          amount: l.amount,
        })),
      });
      return created;
    });

    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'BankStatementImport', entityId: imp.id, summary: `Imported ${parsed.lines.length} lines (${parsed.skipped.length} skipped)` });
    revalidatePath('/treasury');
    return { ok: true, message: `Imported ${parsed.lines.length} line${parsed.lines.length === 1 ? '' : 's'}${parsed.skipped.length ? `, skipped ${parsed.skipped.length}` : ''}. Review the matches below.`, id: imp.id };
  } catch (e) {
    return toActionError(e);
  }
}

// ── Reconciliation ───────────────────────────────────────────────────────────
export async function confirmMatch(lineId: string, voucherId: string, confidence: string): Promise<TreasuryResult> {
  try {
    const ctx = await ensure('treasury.manage');
    const line = await prisma.bankStatementLine.findUnique({ where: { id: lineId }, select: { id: true, refNo: true } });
    if (!line) return { error: 'That statement line no longer exists.' };
    const voucher = await prisma.voucher.findUnique({ where: { id: voucherId }, select: { id: true, utr: true, number: true } });
    if (!voucher) return { error: 'That voucher no longer exists.' };

    await prisma.$transaction(async (tx) => {
      await tx.bankStatementLine.update({
        where: { id: lineId },
        data: { status: 'MATCHED', matchedVoucherId: voucherId, matchConfidence: confidence.slice(0, 40) },
      });
      // Record the UTR back against the voucher when it does not already have one
      // and the statement line carries a reference — closing the loop item 22 asks for.
      if (!voucher.utr && line.refNo) {
        await tx.voucher.update({
          where: { id: voucherId },
          data: { utr: line.refNo.slice(0, 120), utrEnteredById: ctx.user.id, utrEnteredAt: new Date() },
        });
      }
    });

    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'BankStatementLine', entityId: lineId, summary: `Reconciled to ${voucher.number} (${confidence})` });
    revalidatePath('/treasury');
    return { ok: true, message: `Matched to ${voucher.number}.` };
  } catch (e) {
    return toActionError(e);
  }
}

export async function setLineStatus(lineId: string, status: 'UNMATCHED' | 'IGNORED'): Promise<TreasuryResult> {
  try {
    const ctx = await ensure('treasury.manage');
    await prisma.bankStatementLine.update({
      where: { id: lineId },
      data: { status, ...(status === 'UNMATCHED' ? { matchedVoucherId: null, matchConfidence: null } : {}) },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'BankStatementLine', entityId: lineId, summary: status === 'IGNORED' ? 'Line ignored' : 'Match cleared' });
    revalidatePath('/treasury');
    return { ok: true, message: status === 'IGNORED' ? 'Line ignored.' : 'Match cleared.' };
  } catch (e) {
    return toActionError(e);
  }
}

// ── Loans ────────────────────────────────────────────────────────────────────
const loanSchema = z.object({
  id: z.string().optional(),
  lender: z.string().min(2, 'Who is the lender?').max(120),
  kind: z.enum(['TERM_LOAN', 'OVERDRAFT', 'VENTURE_DEBT', 'PROJECT_LOAN', 'OTHER']),
  sanctionedAmount: z.number().nonnegative().optional(),
  interestRate: z.number().nonnegative().max(100).optional().nullable(),
  projectId: z.string().optional().nullable(),
  startedOn: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function saveLoan(input: unknown): Promise<TreasuryResult> {
  try {
    const ctx = await ensure('treasury.manage');
    const d = loanSchema.parse(input);
    const data = {
      lender: d.lender, kind: d.kind,
      sanctionedAmount: d.sanctionedAmount ?? 0,
      interestRate: d.interestRate ?? null,
      projectId: d.projectId ?? null,
      startedOn: d.startedOn ? new Date(d.startedOn) : null,
      notes: d.notes ?? null,
    };
    const saved = d.id
      ? await prisma.loanFacility.update({ where: { id: d.id }, data, select: { id: true } })
      : await prisma.loanFacility.create({ data: { ...data, createdById: ctx.user.id }, select: { id: true } });
    await writeAudit({ actorId: ctx.user.id, action: d.id ? 'UPDATE' : 'CREATE', entityType: 'LoanFacility', entityId: saved.id, summary: `Loan "${d.lender}" (${d.kind})` });
    revalidatePath('/treasury');
    return { ok: true, message: 'Loan saved.', id: saved.id };
  } catch (e) {
    return toActionError(e);
  }
}

export async function addLoanEvent(input: unknown): Promise<TreasuryResult> {
  try {
    const ctx = await ensure('treasury.manage');
    const d = z.object({
      loanId: z.string().min(1),
      kind: z.enum(['DRAWDOWN', 'REPAYMENT', 'INTEREST', 'FEE']),
      amount: z.number().positive('Enter an amount.'),
      eventDate: z.string().optional().nullable(),
      note: z.string().max(300).optional().nullable(),
    }).parse(input);
    await prisma.loanEvent.create({
      data: { loanId: d.loanId, kind: d.kind, amount: d.amount, eventDate: d.eventDate ? new Date(d.eventDate) : new Date(), note: d.note ?? null },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'LoanFacility', entityId: d.loanId, summary: `${d.kind} ${d.amount}` });
    revalidatePath('/treasury');
    return { ok: true, message: `${d.kind.toLowerCase()} recorded.` };
  } catch (e) {
    return toActionError(e);
  }
}
