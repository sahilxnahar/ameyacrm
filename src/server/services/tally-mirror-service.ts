import 'server-only';
import { prisma } from '@/lib/db/prisma';

/**
 * Mirror the CRM's own books into Ameya Tally.
 *
 * Until now these were two unconnected sets of numbers. Every payment, receipt
 * and bill raised in the CRM posted to `JournalEntry`, and Ameya Tally — the
 * screen the accountant actually works in, and the one the statutory reports and
 * the Tally export come out of — knew nothing about any of it. So the CRM's
 * trial balance and the Tally trial balance disagreed by construction, and
 * somebody re-keyed the month into Tally to close the books. That re-keying is
 * where the errors were.
 *
 * The direction is deliberate and one-way: CRM → Tally. The CRM is where the
 * transaction happens (a payment against a vendor bill, a receipt against a
 * booking); Tally is the book of account. Mirroring the other way would let an
 * edit in Tally silently contradict the document it came from.
 *
 * Off unless somebody turns it on, because it writes into a live set of books.
 */

export const MIRROR_COMPANY_KEY = 'tally.mirrorCompanyId';

/** Which Tally company the CRM books mirror into. Null = mirroring is off. */
export async function mirrorCompanyId(): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key: MIRROR_COMPANY_KEY } }).catch(() => null);
  const id = typeof row?.value === 'string' ? row.value : null;
  if (!id) return null;
  const company = await prisma.tallyCompany.findFirst({ where: { id, isActive: true }, select: { id: true } }).catch(() => null);
  return company?.id ?? null;
}

/**
 * Tally group for a CRM account.
 *
 * Tally's groups are the backbone of every one of its reports — put a bank
 * account under "Sundry Debtors" and the balance sheet is wrong in a way no
 * amount of correct posting will fix. The mapping is deliberately coarse and
 * driven off the account code where the chart of accounts has a convention,
 * falling back to the account type.
 */
export function tallyGroupFor(code: string, type: string): string {
  // Codes follow the seeded chart of accounts: 11xx current assets, 115x GST
  // input, 21xx creditors, 214x GST output, 4xxx income, 5xxx/6xxx expenses.
  if (code.startsWith('111')) return 'Cash-in-Hand';
  if (code.startsWith('112')) return 'Bank Accounts';
  if (code.startsWith('113')) return 'Sundry Debtors';
  if (code.startsWith('115')) return 'Duties & Taxes';
  if (code.startsWith('12')) return 'Stock-in-Hand';
  if (code.startsWith('211')) return 'Sundry Creditors';
  if (code.startsWith('212')) return 'Current Liabilities';
  if (code.startsWith('214')) return 'Duties & Taxes';

  // 5xxx is direct project cost. In Tally that has to sit under Direct
  // Expenses, or it falls below the gross-profit line and every construction
  // margin the reports show is wrong.
  if (code.startsWith('5')) return 'Direct Expenses';

  switch (type) {
    case 'ASSET': return 'Current Assets';
    case 'LIABILITY': return 'Current Liabilities';
    case 'EQUITY': return 'Capital Account';
    case 'INCOME': return 'Sales Accounts';
    case 'EXPENSE': return 'Indirect Expenses';
    default: return 'Suspense A/c';
  }
}

/** Tally voucher type for whatever in the CRM caused the entry. */
export function tallyTypeFor(sourceType: string | null | undefined, hasBank: boolean, isReceipt: boolean): string {
  switch (sourceType) {
    case 'Invoice': return 'Sales';
    case 'VendorBill': return 'Purchase';
    case 'Voucher': return isReceipt ? 'Receipt' : 'Payment';
    default: return hasBank ? (isReceipt ? 'Receipt' : 'Payment') : 'Journal';
  }
}

/**
 * Find or create the Tally ledger that stands for a CRM account.
 *
 * Matched by name, because that is what the accountant recognises and what an
 * existing imported Tally company will already contain — matching on a code the
 * imported books have never heard of would create a duplicate ledger beside
 * every real one.
 */
async function ledgerFor(companyId: string, account: { code: string; name: string; type: string }): Promise<string> {
  const existing = await prisma.tallyLedger.findFirst({
    where: { companyId, name: account.name },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.tallyLedger.create({
    data: { companyId, name: account.name, group: tallyGroupFor(account.code, account.type) },
    select: { id: true },
  });
  return created.id;
}

/**
 * Mirror one posted journal entry.
 *
 * Idempotent on `tallyGuid = crm:<entryId>`, which the schema makes unique per
 * company. Re-running a backfill, a retried webhook or a double-clicked button
 * therefore cannot produce a second voucher for the same entry.
 *
 * Never throws: the CRM entry is the record, and a books-mirroring problem must
 * not fail the payment that caused it.
 */
export async function mirrorJournalEntry(entryId: string): Promise<{ ok: true; created: boolean } | { error: string }> {
  try {
    const companyId = await mirrorCompanyId();
    if (!companyId) return { ok: true, created: false };

    const guid = `crm:${entryId}`;
    const already = await prisma.tallyVoucher.findFirst({ where: { companyId, tallyGuid: guid }, select: { id: true } });
    if (already) return { ok: true, created: false };

    const entry = await prisma.journalEntry.findUnique({
      where: { id: entryId },
      select: {
        id: true, entryDate: true, narration: true, status: true, sourceType: true, createdById: true,
        lines: {
          select: {
            debit: true, credit: true,
            account: { select: { code: true, name: true, type: true } },
          },
        },
      },
    });
    if (!entry || entry.status !== 'POSTED' || entry.lines.length < 2) return { ok: true, created: false };

    const hasBank = entry.lines.some((l) => l.account.code.startsWith('111') || l.account.code.startsWith('112'));
    // A receipt is money arriving: cash or bank on the debit side.
    const isReceipt = entry.lines.some(
      (l) => (l.account.code.startsWith('111') || l.account.code.startsWith('112')) && Number(l.debit) > 0,
    );
    const type = tallyTypeFor(entry.sourceType, hasBank, isReceipt);

    const lines: { ledgerId: string; debit: number; credit: number }[] = [];
    for (const l of entry.lines) {
      lines.push({
        ledgerId: await ledgerFor(companyId, l.account),
        debit: Number(l.debit),
        credit: Number(l.credit),
      });
    }

    // Continue the company's own series for this voucher type, so mirrored
    // vouchers sit in the same numbering the accountant already reads.
    //
    // MAX+1 races two simultaneous postings onto the same number, and
    // (companyId, type, number) is unique — so the loser used to be silently
    // dropped and never mirrored. Retry instead of losing the entry.
    for (let attempt = 0; attempt < 5; attempt++) {
      const max = await prisma.tallyVoucher.aggregate({ where: { companyId, type }, _max: { number: true } });
      const number = (max._max.number ?? 0) + 1 + attempt;
      try {
        await prisma.tallyVoucher.create({
          data: {
            companyId, type, number,
            date: entry.entryDate,
            narration: entry.narration.slice(0, 500),
            reference: entry.id,
            tallyGuid: guid,
            createdById: entry.createdById,
            lines: { create: lines },
          },
          select: { id: true },
        });
        return { ok: true, created: true };
      } catch (e) {
        // Another writer took that number (or this entry was mirrored a moment
        // ago by a concurrent caller). Re-read and try the next one.
        const already = await prisma.tallyVoucher.findFirst({ where: { companyId, tallyGuid: guid }, select: { id: true } });
        if (already) return { ok: true, created: false };
        if (attempt === 4) throw e;
      }
    }
    return { ok: true, created: false };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'The entry could not be mirrored into Tally.' };
  }
}

/**
 * Mirror everything not yet mirrored — used when somebody first switches this
 * on, and as the repair for any entry a live mirror missed.
 *
 * Ordered oldest-first so the Tally voucher numbers come out in date order.
 */
export async function backfillMirror(limit = 500): Promise<{ mirrored: number; skipped: number; message: string }> {
  const companyId = await mirrorCompanyId();
  if (!companyId) return { mirrored: 0, skipped: 0, message: 'Mirroring is off — choose a Tally company first.' };

  // Only what is NOT already there. Taking the oldest N unfiltered meant that
  // past the first N entries the backfill re-scanned the same block every run
  // and anything the live mirror had missed beyond it was unreachable.
  const already = await prisma.tallyVoucher.findMany({
    where: { companyId, tallyGuid: { startsWith: 'crm:' } },
    select: { tallyGuid: true },
  });
  const done = new Set(already.map((m) => m.tallyGuid?.slice(4)).filter((x): x is string => !!x));

  const entries = (await prisma.journalEntry.findMany({
    where: { status: 'POSTED' },
    orderBy: [{ entryDate: 'asc' }, { number: 'asc' }],
    select: { id: true },
  })).filter((e) => !done.has(e.id)).slice(0, limit);

  let mirrored = 0, skipped = 0;
  for (const e of entries) {
    const r = await mirrorJournalEntry(e.id);
    if ('error' in r) skipped++;
    else if (r.created) mirrored++;
    else skipped++;
  }
  return {
    mirrored, skipped,
    message: `${mirrored} entr${mirrored === 1 ? 'y' : 'ies'} copied into Tally${skipped ? `, ${skipped} already there or not eligible` : ''}.`,
  };
}
