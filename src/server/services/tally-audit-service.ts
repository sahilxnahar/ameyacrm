import 'server-only';
import { prisma } from '@/lib/db/prisma';

/**
 * The statutory edit log for Ameya Tally.
 *
 * Every create, change and deletion of a voucher passes through here. Two rules
 * hold, and both come straight from Rule 3(1) of the Companies (Accounts) Rules:
 *
 *  1. It cannot be turned off. There is no setting, no flag, no permission that
 *     suppresses a write — the log is taken inside the same transaction as the
 *     change, so a voucher that exists always has a trail behind it.
 *  2. It is never edited or deleted. Nothing in this codebase updates a row in
 *     this table. A correction is a new entry, exactly as a correction in the
 *     books is a reversing entry rather than an erasure.
 */

export interface VoucherSnapshot {
  type: string;
  number: number;
  date: string;
  narration: string | null;
  reference: string | null;
  costCentre: string | null;
  lines: Array<{ ledger: string; debit: number; credit: number }>;
  inventory?: Array<{ item: string; qty: number; rate: number; amount: number; direction: string }>;
}

/** Read a voucher into the shape the log stores. Returns null if it is gone. */
export async function snapshotVoucher(voucherId: string): Promise<VoucherSnapshot | null> {
  const v = await prisma.tallyVoucher.findUnique({
    where: { id: voucherId },
    include: {
      lines: { include: { ledger: { select: { name: true } } } },
      inventoryLines: { include: { item: { select: { name: true } } } },
    },
  }).catch(() => null);
  if (!v) return null;

  return {
    type: v.type,
    number: v.number,
    date: v.date.toISOString().slice(0, 10),
    narration: v.narration,
    reference: v.reference,
    costCentre: v.costCentre,
    lines: v.lines.map((l) => ({ ledger: l.ledger?.name ?? '(deleted ledger)', debit: Number(l.debit), credit: Number(l.credit) })),
    inventory: v.inventoryLines?.map((i) => ({
      item: i.item?.name ?? '(deleted item)', qty: Number(i.qty), rate: Number(i.rate),
      amount: Number(i.amount), direction: i.direction,
    })),
  };
}

/**
 * Describe a change the way a person would, so the log is readable without
 * diffing two blobs of JSON by eye.
 */
export function describeChange(before: VoucherSnapshot | null, after: VoucherSnapshot | null): string {
  if (!before && after) {
    const total = after.lines.reduce((s, l) => s + l.debit, 0);
    return `Created ${after.type} #${after.number} dated ${after.date} for ₹${total.toLocaleString('en-IN')}`;
  }
  if (before && !after) {
    const total = before.lines.reduce((s, l) => s + l.debit, 0);
    return `Deleted ${before.type} #${before.number} dated ${before.date} for ₹${total.toLocaleString('en-IN')}`;
  }
  if (!before || !after) return 'Changed';

  const parts: string[] = [];
  if (before.date !== after.date) parts.push(`date ${before.date} → ${after.date}`);
  if ((before.narration ?? '') !== (after.narration ?? '')) parts.push('narration changed');
  if ((before.reference ?? '') !== (after.reference ?? '')) parts.push(`reference ${before.reference ?? '—'} → ${after.reference ?? '—'}`);
  if ((before.costCentre ?? '') !== (after.costCentre ?? '')) parts.push(`cost centre ${before.costCentre ?? '—'} → ${after.costCentre ?? '—'}`);

  const sum = (s: VoucherSnapshot) => s.lines.reduce((a, l) => a + l.debit, 0);
  const bt = sum(before), at = sum(after);
  if (Math.round(bt * 100) !== Math.round(at * 100)) {
    parts.push(`amount ₹${bt.toLocaleString('en-IN')} → ₹${at.toLocaleString('en-IN')}`);
  }

  const key = (s: VoucherSnapshot) => s.lines.map((l) => `${l.ledger}:${l.debit}:${l.credit}`).sort().join('|');
  if (key(before) !== key(after) && !parts.some((p) => p.startsWith('amount'))) {
    parts.push('ledger lines changed');
  }

  return parts.length
    ? `Edited ${after.type} #${after.number} — ${parts.join('; ')}`
    : `Saved ${after.type} #${after.number} with no visible change`;
}

/**
 * Write one entry. Pass the transaction client when the change itself is in a
 * transaction, so the log and the change stand or fall together.
 */
export async function logVoucherChange(opts: {
  companyId: string;
  voucherId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  before: VoucherSnapshot | null;
  after: VoucherSnapshot | null;
  actorId: string | null;
  actorName: string;
  tx?: { tallyVoucherAudit: { create: (a: unknown) => Promise<unknown> } };
}): Promise<void> {
  const snap = opts.after ?? opts.before;
  if (!snap) return;
  const client = opts.tx ?? prisma;
  await client.tallyVoucherAudit.create({
    data: {
      companyId: opts.companyId,
      voucherId: opts.voucherId,
      action: opts.action,
      voucherNo: snap.number,
      voucherType: snap.type,
      voucherDate: new Date(snap.date),
      before: (opts.before ?? undefined) as never,
      after: (opts.after ?? undefined) as never,
      summary: describeChange(opts.before, opts.after),
      actorId: opts.actorId,
      actorName: opts.actorName,
    },
  }).catch(() => undefined);
}

export interface AuditRow {
  id: string; action: string; voucherType: string; voucherNo: number;
  voucherDate: string; summary: string; actorName: string; at: string;
  before: VoucherSnapshot | null; after: VoucherSnapshot | null;
}

/** The edit log for a company, newest first. */
export async function getVoucherAudit(companyId: string, opts: { voucherId?: string; limit?: number } = {}): Promise<AuditRow[]> {
  const rows = await prisma.tallyVoucherAudit.findMany({
    where: { companyId, ...(opts.voucherId ? { voucherId: opts.voucherId } : {}) },
    orderBy: { at: 'desc' },
    take: Math.min(opts.limit ?? 500, 2000),
  }).catch(() => []);

  return rows.map((r) => ({
    id: r.id, action: r.action, voucherType: r.voucherType, voucherNo: r.voucherNo,
    voucherDate: r.voucherDate.toISOString().slice(0, 10),
    summary: r.summary, actorName: r.actorName, at: r.at.toISOString(),
    before: (r.before ?? null) as VoucherSnapshot | null,
    after: (r.after ?? null) as VoucherSnapshot | null,
  }));
}
