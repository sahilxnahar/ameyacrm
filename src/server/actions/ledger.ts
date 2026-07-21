'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';
import { post, reverse, seedChartOfAccounts } from '@/server/services/ledger-service';

export type LedgerResult = { ok: true; message: string } | { error: string };

const journalSchema = z.object({
  entryDate: z.string().optional(),
  narration: z.string().min(3, 'Say what this entry is for.').max(500),
  projectId: z.string().optional().nullable(),
  lines: z.array(z.object({
    accountCode: z.string().min(1),
    debit: z.union([z.string(), z.number()]).optional(),
    credit: z.union([z.string(), z.number()]).optional(),
    narration: z.string().max(300).optional(),
  })).min(2, 'An entry needs at least two lines.'),
});

/** Post a journal entry by hand. Finance permission only. */
export async function postJournal(input: unknown): Promise<LedgerResult> {
  try {
    const ctx = await ensure('finance.ledger.manage');
    const d = journalSchema.parse(input);
    const r = await post({
      entryDate: d.entryDate ? new Date(d.entryDate) : new Date(),
      narration: d.narration,
      lines: d.lines,
      projectId: d.projectId ?? null,
      sourceType: 'Manual',
      createdById: ctx.user.id,
    });
    if ('error' in r) return r;
    await writeAudit({
      actorId: ctx.user.id, action: 'CREATE', entityType: 'JournalEntry', entityId: r.entryId,
      summary: `Posted ${r.number}: ${d.narration}`,
    });
    revalidatePath('/ledger');
    return { ok: true, message: `Posted as ${r.number}.` };
  } catch (e) {
    return toActionError(e);
  }
}

/** Reverse a posted entry. The original is never edited. */
export async function reverseJournal(entryId: string, reason: string): Promise<LedgerResult> {
  try {
    const ctx = await ensure('finance.ledger.manage');
    if (!reason || reason.trim().length < 3) return { error: 'Say why it is being reversed — this goes in the books.' };
    const r = await reverse(entryId, reason.trim(), ctx.user.id);
    if ('error' in r) return r;
    await writeAudit({
      actorId: ctx.user.id, action: 'UPDATE', entityType: 'JournalEntry', entityId: entryId,
      summary: `Reversed by ${r.number}: ${reason.trim()}`,
    });
    revalidatePath('/ledger');
    return { ok: true, message: `Reversed by ${r.number}.` };
  } catch (e) {
    return toActionError(e);
  }
}

/** Create the chart of accounts. Safe to run more than once. */
export async function setUpChartOfAccounts(): Promise<LedgerResult> {
  try {
    const ctx = await ensure('finance.ledger.manage');
    const r = await seedChartOfAccounts();
    if (r.missing.length) {
      return { error: `The chart was created but ${r.missing.length} account(s) the posting rules need are missing: ${r.missing.join(', ')}.` };
    }
    await writeAudit({
      actorId: ctx.user.id, action: 'CREATE', entityType: 'Setting',
      summary: `Chart of accounts: ${r.created} account(s) created`,
    });
    revalidatePath('/ledger');
    revalidatePath('/ledger/accounts');
    return {
      ok: true,
      message: r.created
        ? `${r.created} accounts created. The books are ready.`
        : 'Every account already exists — nothing to do.',
    };
  } catch (e) {
    return toActionError(e);
  }
}

/** Set an account's opening balance, so history need not be re-entered. */
export async function setOpeningBalance(accountId: string, amount: number, asOf: string): Promise<LedgerResult> {
  try {
    const ctx = await ensure('finance.ledger.manage');
    if (!Number.isFinite(amount)) return { error: 'That is not an amount.' };
    const a = await prisma.account.update({
      where: { id: accountId },
      data: { openingBalance: amount, openingAsOf: new Date(asOf) },
      select: { name: true },
    });
    await writeAudit({
      actorId: ctx.user.id, action: 'UPDATE', entityType: 'Account', entityId: accountId,
      summary: `Opening balance for ${a.name} set to ${amount}`,
    });
    revalidatePath('/ledger/accounts');
    return { ok: true, message: `Opening balance saved for ${a.name}.` };
  } catch (e) {
    return toActionError(e);
  }
}
