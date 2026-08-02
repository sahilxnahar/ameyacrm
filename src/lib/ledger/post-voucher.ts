import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';

/**
 * Turn a saved voucher into a balanced ledger entry.
 *
 * This used to live inside `actions/vouchers.ts`, which meant only ONE of the
 * six places that create a voucher ever reached the books. RA-bill settlements,
 * piece-rate settlements, recurring payments, vendor payments, CSV imports and
 * Razorpay collections all wrote money to the cash book and nothing to the
 * ledger — so the trial balance was decorative. It lives here now so every
 * creator can call it.
 *
 * Never throws. Every failure is swallowed and recorded as an audit line
 * ("saved but NOT posted"), and the voucher shows up in the unposted count on
 * the ledger screen so it can be posted later. The voucher is the record of
 * fact; the ledger entry is a consequence of it. Losing the payment because the
 * chart of accounts was not ready would be the worse failure by a wide margin.
 */
export interface PostableVoucher {
  id: string;
  kind: string;
  amount: unknown;
  gstAmount?: unknown;
  mode: string;
  partyName: string;
  projectId: string | null;
  voucherDate: Date;
  number: string;
  /** The expense head the payment was categorised to. */
  accountCode?: string | null;
  /** Carried onto every line, so a party ledger is a real ledger. */
  vendorId?: string | null;
  customerId?: string | null;
  /** Deductions held back from a contractor payment. */
  tdsAmount?: unknown;
  retentionAmount?: unknown;
  cessAmount?: unknown;
  /** Set when this payment settles a vendor bill already booked in the ledger. */
  vendorBillId?: string | null;
}

const SELECT = {
  id: true, kind: true, amount: true, gstAmount: true, mode: true,
  partyName: true, projectId: true, voucherDate: true, number: true,
  accountCode: true, vendorId: true, customerId: true,
  tdsAmount: true, retentionAmount: true, cessAmount: true, vendorBillId: true,
} as const;

async function note(v: { id: string; number: string }, actorId: string | null, why: string): Promise<void> {
  await writeAudit({
    actorId,
    action: 'UPDATE',
    entityType: 'Voucher',
    entityId: v.id,
    summary: `Voucher ${v.number} saved but NOT posted to the ledger: ${why}`,
  }).catch(() => undefined);
}

/**
 * A category is only usable if it exists and is not a heading.
 *
 * `accountCode` is free text on the voucher — it comes from a picker, from
 * `categorizeExpense`'s guess, and from RA bills, which set the GROUP code 5400.
 * Posting to a heading is refused by the ledger, so an unusable code would stop
 * the entry reaching the books at all. Dropping the code instead posts to the
 * rule's default: a payment in the right books beats a payment in no books.
 */
async function usableCode(code: string | null | undefined): Promise<string | null> {
  const c = (code ?? '').trim();
  if (!c) return null;
  const a = await prisma.account.findUnique({ where: { code: c }, select: { isGroup: true, isActive: true } }).catch(() => null);
  if (!a || a.isGroup || !a.isActive) return null;
  return c;
}

export async function postVoucherToLedger(v: PostableVoucher, actorId: string | null): Promise<void> {
  try {
    const { voucherLines, contractorSettlementLines, billSettlementLines } = await import('@/lib/ledger/posting-rules');
    const { post } = await import('@/server/services/ledger-service');

    const tds = Number(v.tdsAmount ?? 0) || 0;
    const retention = Number(v.retentionAmount ?? 0) || 0;
    const cess = Number(v.cessAmount ?? 0) || 0;
    const accountCode = await usableCode(v.accountCode);

    const common = {
      amount: Number(v.amount),
      gstAmount: v.gstAmount === null || v.gstAmount === undefined ? null : Number(v.gstAmount),
      mode: v.mode,
      projectId: v.projectId,
      partyName: v.partyName,
      vendorId: v.vendorId ?? null,
      customerId: v.customerId ?? null,
      accountCode,
    };

    // A contractor payment with TDS or retention held back is not a simple
    // "expense Dr, bank Cr". The amount that leaves the bank is the net, but the
    // cost is the gross and the deductions are liabilities you still owe — to
    // the government under s.194C, and to the contractor on defect-liability
    // expiry. Booking only the net understates project cost and leaves the 26Q
    // deposit with no balance to clear against.
    const isPayment = v.kind === 'CASH_PAID' || v.kind === 'BANK_PAID';

    // A payment against a bill already in the books clears the creditor. Booking
    // the expense again would count the same spend twice and leave the payable
    // standing for ever — the exact damage that appeared the moment vendor bills
    // started posting and payments carried on posting as though they had not.
    const rule = isPayment && v.vendorBillId
      ? billSettlementLines({ amount: Number(v.amount), mode: v.mode, vendorId: v.vendorId ?? null, projectId: v.projectId, partyName: v.partyName, tdsAmount: tds, retentionAmount: retention })
      : isPayment && (tds > 0 || retention > 0 || cess > 0)
        ? contractorSettlementLines({ kind: v.kind, ...common, tdsAmount: tds, retentionAmount: retention, cessAmount: cess })
        : voucherLines({ kind: v.kind, ...common });

    // No rule for this voucher kind yet — not an error worth an audit line.
    if ('error' in rule) return;

    const result = await post({
      entryDate: v.voucherDate,
      narration: `${v.number} — ${rule.narration}`,
      lines: rule.lines,
      sourceType: 'Voucher',
      sourceId: v.id,
      projectId: v.projectId,
      createdById: actorId,
      // Idempotent: re-running an import or a retried webhook must not double-post.
      once: true,
    });
    if ('error' in result) await note(v, actorId, result.error);
  } catch (err) {
    await note(v, actorId, err instanceof Error ? err.message : 'posting error');
  }
}

/**
 * Same, for callers that only hold the voucher id — the several creators that
 * write with a narrow `select`, or that must post AFTER their transaction has
 * committed (posting inside the tx would roll the money back with the books).
 */
export async function postVoucherById(voucherId: string, actorId: string | null): Promise<void> {
  try {
    const v = await prisma.voucher.findUnique({ where: { id: voucherId }, select: SELECT });
    if (!v) return;
    await postVoucherToLedger(v, actorId);
  } catch {
    // A voucher we cannot even read is a voucher we cannot post; the unposted
    // count on the ledger screen still surfaces it.
  }
}

/**
 * Vouchers that should be in the books and are not.
 *
 * Every failure above is deliberately non-fatal, which is only defensible if
 * somebody can see the backlog and clear it. Without this, "saved but NOT
 * posted" was an audit line nobody reads and the money was invisible to the
 * trial balance for good.
 */
export async function unpostedVouchers(limit = 200): Promise<{ id: string; number: string; partyName: string; amount: number; voucherDate: Date }[]> {
  const posted = await prisma.journalEntry.findMany({
    where: { sourceType: 'Voucher', status: { not: 'REVERSED' } },
    select: { sourceId: true },
  });
  const done = new Set(posted.map((p) => p.sourceId).filter((x): x is string => !!x));

  const candidates = await prisma.voucher.findMany({
    where: { status: 'POSTED' },
    orderBy: { voucherDate: 'desc' },
    take: 2000,
    select: { id: true, number: true, partyName: true, amount: true, voucherDate: true },
  });
  return candidates.filter((v) => !done.has(v.id)).slice(0, limit).map((v) => ({ ...v, amount: Number(v.amount) }));
}

/** Post everything in that backlog. Safe to run repeatedly. */
export async function postUnposted(actorId: string | null, limit = 200): Promise<{ attempted: number; posted: number }> {
  const rows = await unpostedVouchers(limit);
  let posted = 0;
  for (const r of rows) {
    await postVoucherById(r.id, actorId);
    const now = await prisma.journalEntry.findFirst({ where: { sourceType: 'Voucher', sourceId: r.id, status: { not: 'REVERSED' } }, select: { id: true } });
    if (now) posted++;
  }
  return { attempted: rows.length, posted };
}
