import { describe, it, expect, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

/**
 * Cancelling a payment must leave the books exactly where they started.
 *
 * This is the test that was missing. `reverse()` posts the opposite entry AND
 * marks the original REVERSED; every reader filtered `status: 'POSTED'`, which
 * kept the reversal and dropped the original. A cancelled ₹10,00,000 payment
 * therefore moved the trial balance by ₹10,00,000 in the WRONG direction —
 * bank up, expense negative — and because both sides moved together the
 * "balanced" flag stayed true and nothing complained.
 *
 * Needs a throwaway Postgres in LIVE_DB; skipped otherwise.
 */
const LIVE = process.env.LIVE_DB;
const suite = LIVE ? describe : describe.skip;
const prisma = new PrismaClient({ datasources: { db: { url: LIVE ?? 'postgresql://unused' } } });

suite('a reversal nets to zero', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = LIVE!;
    const { seedChartOfAccounts } = await import('@/server/services/ledger-service');
    await seedChartOfAccounts();
    // Re-runnable against the same database: the `once` guard would otherwise
    // refuse the second run's postings and the failure would look like a bug.
    const stale = await prisma.journalEntry.findMany({ where: { sourceId: { startsWith: 'rev-' } }, select: { id: true } });
    const ids = stale.map((e) => e.id);
    if (ids.length) {
      await prisma.journalLine.deleteMany({ where: { entryId: { in: ids } } });
      await prisma.journalEntry.deleteMany({ where: { id: { in: ids } } });
    }
  }, 60_000);

  const bal = async (code: string) => {
    const { trialBalance } = await import('@/server/services/ledger-service');
    const tb = await trialBalance();
    return { v: tb.rows.find((r) => r.code === code)?.balance ?? 0, balanced: tb.balanced };
  };

  it('leaves both accounts and the balanced flag exactly as they were', async () => {
    const { post, reverse } = await import('@/server/services/ledger-service');
    const { voucherLines } = await import('@/lib/ledger/posting-rules');

    const bank0 = (await bal('1121')).v;
    const cost0 = (await bal('6900')).v;

    const rule = voucherLines({ kind: 'BANK_PAID', amount: 1000000, mode: 'BANK_TRANSFER', partyName: 'Civil Co', projectId: null });
    if (!('ok' in rule)) throw new Error('rule');
    const p = await post({ narration: 'Pay', lines: rule.lines, sourceType: 'Voucher', sourceId: 'rev-1', createdById: null });
    if (!('ok' in p)) throw new Error(p.error);

    expect((await bal('6900')).v - cost0).toBeCloseTo(1000000, 2);

    const r = await reverse(p.entryId, 'cancelled');
    expect('ok' in r).toBe(true);

    const after = await bal('6900');
    expect(after.v - cost0).toBeCloseTo(0, 2);
    expect((await bal('1121')).v - bank0).toBeCloseTo(0, 2);
    expect(after.balanced).toBe(true);
  }, 60_000);

  it('nets to zero for a party ledger too, not just the trial balance', async () => {
    const { post, reverse, partyLedger } = await import('@/server/services/ledger-service');
    const { voucherLines } = await import('@/lib/ledger/posting-rules');
    await prisma.vendor.deleteMany({ where: { name: 'Reversal Co' } });
    const vendor = await prisma.vendor.create({ data: { name: 'Reversal Co' }, select: { id: true } });

    const rule = voucherLines({ kind: 'BANK_PAID', amount: 250000, mode: 'BANK_TRANSFER', partyName: 'Reversal Co', vendorId: vendor.id, projectId: null });
    if (!('ok' in rule)) throw new Error('rule');
    const p = await post({ narration: 'Pay', lines: rule.lines, sourceType: 'Voucher', sourceId: 'rev-2', createdById: null });
    if (!('ok' in p)) throw new Error(p.error);
    await reverse(p.entryId, 'cancelled');

    const led = await partyLedger({ vendorId: vendor.id });
    const net = led.lines.reduce((s, r) => s + Number(r.debit) - Number(r.credit), 0);
    expect(led.lines.length).toBeGreaterThan(0);   // both halves are present…
    expect(net).toBeCloseTo(0, 2);                  // …and they cancel out
    expect(Number(led.balance)).toBeCloseTo(0, 2);
  }, 60_000);

  it('a reversed entry can be posted again, so cancel-then-restore works', async () => {
    const { post, reverse } = await import('@/server/services/ledger-service');
    const { voucherLines } = await import('@/lib/ledger/posting-rules');
    const cost0 = (await bal('6900')).v;

    const rule = voucherLines({ kind: 'BANK_PAID', amount: 60000, mode: 'BANK_TRANSFER', partyName: 'Restore Co', projectId: null });
    if (!('ok' in rule)) throw new Error('rule');

    const first = await post({ narration: 'Pay', lines: rule.lines, sourceType: 'Voucher', sourceId: 'rev-3', createdById: null, once: true });
    if (!('ok' in first)) throw new Error(first.error);
    await reverse(first.entryId, 'removed');
    expect((await bal('6900')).v - cost0).toBeCloseTo(0, 2);

    // Restoring posts a fresh entry — the `once` guard must let it through
    // because the earlier one is REVERSED.
    const again = await post({ narration: 'Restored', lines: rule.lines, sourceType: 'Voucher', sourceId: 'rev-3', createdById: null, once: true });
    expect('ok' in again).toBe(true);
    expect((await bal('6900')).v - cost0).toBeCloseTo(60000, 2);
  }, 60_000);

  it('mirrors both halves into Tally, so the two trial balances agree', async () => {
    const { MIRROR_COMPANY_KEY, backfillMirror } = await import('@/server/services/tally-mirror-service');
    const co = await prisma.tallyCompany.upsert({ where: { name: 'Rev Books' }, create: { name: 'Rev Books' }, update: {}, select: { id: true } });
    await prisma.setting.upsert({ where: { key: MIRROR_COMPANY_KEY }, create: { key: MIRROR_COMPANY_KEY, value: co.id }, update: { value: co.id } });
    await backfillMirror(500);

    // Every live entry — including the REVERSED originals — must be in Tally,
    // or Tally inherits the same asymmetry the CRM used to have.
    const crmIds = (await prisma.journalEntry.findMany({ where: { status: { in: ['POSTED', 'REVERSED'] } }, select: { id: true } })).map((e) => e.id);
    const mirrored = new Set(
      (await prisma.tallyVoucher.findMany({ where: { companyId: co.id, tallyGuid: { startsWith: 'crm:' } }, select: { tallyGuid: true } }))
        .map((t) => t.tallyGuid!.slice(4)),
    );
    const notMirrored = crmIds.filter((id) => !mirrored.has(id));
    expect(notMirrored, `these entries never reached Tally: ${notMirrored.join(', ')}`).toEqual([]);

    const lines = await prisma.tallyVoucherLine.findMany({ where: { voucher: { companyId: co.id } } });
    const dr = lines.reduce((s, l) => s + Number(l.debit), 0);
    const cr = lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(dr).toBeCloseTo(cr, 2);
  }, 60_000);
});

suite('money that has not been approved is not money spent', () => {
  it('is left out of every "what have we spent" reader', async () => {
    const project = await prisma.project.upsert({ where: { code: 'SPEND' }, create: { code: 'SPEND', name: 'Spend Test' }, update: {}, select: { id: true } });
    await prisma.voucher.deleteMany({ where: { number: { in: ['CP-77001', 'CP-77002'] } } });
    await prisma.vendor.deleteMany({ where: { name: 'Pending Co' } });
    const vendor = await prisma.vendor.create({ data: { name: 'Pending Co' }, select: { id: true } });

    await prisma.voucher.create({ data: { number: 'CP-77001', kind: 'BANK_PAID', status: 'POSTED', partyName: 'Pending Co', vendorId: vendor.id, projectId: project.id, amount: 100000, mode: 'BANK_TRANSFER', tdsAmount: 1000 } });
    await prisma.voucher.create({ data: { number: 'CP-77002', kind: 'BANK_PAID', status: 'DRAFT', partyName: 'Pending Co', vendorId: vendor.id, projectId: project.id, amount: 4000000, mode: 'BANK_TRANSFER', tdsAmount: 40000 } });

    const { NOT_CANCELLED_OR_PENDING } = await import('@/lib/ledger/spent');
    const spent = await prisma.voucher.aggregate({
      where: { vendorId: vendor.id, kind: { in: ['CASH_PAID', 'BANK_PAID'] }, ...NOT_CANCELLED_OR_PENDING },
      _sum: { amount: true, tdsAmount: true },
    });
    // The ₹40,00,000 awaiting approval must not appear as spent, and its TDS
    // must not appear on the 26Q dashboard as a liability already incurred.
    expect(Number(spent._sum.amount)).toBeCloseTo(100000, 2);
    expect(Number(spent._sum.tdsAmount)).toBeCloseTo(1000, 2);
  }, 30_000);

  it('stops the MSME clock when the bill is paid, and restarts it if that is undone', async () => {
    const { closeMsmeClockForBill, reopenMsmeClockForBill } = await import('@/server/services/msme-service');
    await prisma.vendorBill.deleteMany({ where: { number: 'VB-77001' } });
    await prisma.vendor.deleteMany({ where: { name: 'MSME Co' } });
    const vendor = await prisma.vendor.create({ data: { name: 'MSME Co', isMsme: true }, select: { id: true } });
    const bill = await prisma.vendorBill.create({ data: { number: 'VB-77001', vendorId: vendor.id, amount: 800000, gstAmount: 0 }, select: { id: true } });
    const past = new Date(Date.now() - 10 * 86400000);
    await prisma.msmePaymentClock.create({ data: { vendorId: vendor.id, vendorBillId: bill.id, billDate: past, dueDate: past, amount: 800000, status: 'OVERDUE' } });

    await closeMsmeClockForBill(bill.id, null);
    expect((await prisma.msmePaymentClock.findUniqueOrThrow({ where: { vendorBillId: bill.id } })).status).toBe('PAID');

    // A paid bill must drop out of the exposure total and stop warning on every
    // future settlement for that vendor.
    const { vendorMsmeOverdue } = await import('@/server/services/msme-service');
    expect((await vendorMsmeOverdue(vendor.id)).overdue).toBe(false);

    await reopenMsmeClockForBill(bill.id);
    expect((await prisma.msmePaymentClock.findUniqueOrThrow({ where: { vendorBillId: bill.id } })).status).toBe('OVERDUE');
  }, 30_000);
});
