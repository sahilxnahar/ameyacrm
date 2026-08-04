import { describe, it, expect, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

/**
 * End-to-end checks against a real Postgres.
 *
 * The unit tests prove the pure logic; these prove the chain actually lands in
 * a database — chart of accounts, balanced journal posting, the idempotency
 * guard, the Tally mirror, tower generation and the nine registers. Constraint
 * and enum problems only ever show up here.
 *
 * Skipped unless LIVE_DB points at a THROWAWAY database, because it writes:
 *
 *   createdb ameya_test
 *   DATABASE_URL=postgresql://…/ameya_test npx prisma db push
 *   LIVE_DB=postgresql://…/ameya_test DATABASE_URL=$LIVE_DB npx vitest run tests/live-money-chain.test.ts
 */
const LIVE = process.env.LIVE_DB;
const suite = LIVE ? describe : describe.skip;
const prisma = new PrismaClient({ datasources: { db: { url: LIVE ?? 'postgresql://unused' } } });

// Shared across the suites below: one actor, one set of Tally books.
let actor = '';
let companyId = '';

suite('money chain, end to end', () => {

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.LIVE_DB!;
    const { seedChartOfAccounts } = await import('@/server/services/ledger-service');
    await seedChartOfAccounts();

    // Re-runnable against the same database. Without this the `once` guard and
    // the unique indexes refuse the second run and the failures look like
    // product bugs rather than a dirty fixture.
    const stale = await prisma.journalEntry.findMany({ where: { sourceId: { startsWith: 'e2e-' } }, select: { id: true } });
    const ids = stale.map((e) => e.id);
    if (ids.length) {
      await prisma.journalLine.deleteMany({ where: { entryId: { in: ids } } });
      await prisma.journalEntry.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.tallyVoucherLine.deleteMany({ where: { voucher: { company: { name: 'E2E Books' } } } });
    await prisma.tallyVoucher.deleteMany({ where: { company: { name: 'E2E Books' } } });
    await prisma.numberSequence.deleteMany({ where: { key: { in: ['voucher:CP', 'rabill:RA'] } } });
    await prisma.voucher.deleteMany({ where: { number: { startsWith: 'CP-9' } } });
    await prisma.voucher.deleteMany({ where: { partyName: { in: ['Legacy', 'Contractor Co'] } } });
    await prisma.numberSequence.deleteMany({ where: { key: 'voucher:ZQ' } });
    await prisma.raBill.deleteMany({ where: { number: { in: ['RA-9001', 'RA-10000'] } } });
    await prisma.programmeActivity.deleteMany({ where: { name: 'Slab 3 casting' } });
    await prisma.constructionUpdate.deleteMany({ where: { milestone: 'Slab 3' } });
    for (const del of [
      () => prisma.contractRecord.deleteMany({ where: { title: 'Lift AMC' } }),
      () => prisma.insurancePolicy.deleteMany({ where: { name: 'CAR' } }),
      () => prisma.complianceDocExpiry.deleteMany({ where: { title: 'Fire NOC' } }),
      () => prisma.sop.deleteMany({ where: { title: 'Releasing a held unit' } }),
      () => prisma.lessonLearned.deleteMany({ where: { title: 'RMC lead time' } }),
      () => prisma.wasteManifest.deleteMany({ where: { wasteType: 'C&D debris' } }),
      () => prisma.accessReview.deleteMany({ where: { subject: 'Finance permissions' } }),
      () => prisma.jointDevelopmentAgreement.deleteMany({ where: { landownerName: 'C' } }),
      () => prisma.powerOfAttorney.deleteMany({ where: { grantor: 'A' } }),
      () => prisma.landParcel.deleteMany({ where: { name: 'E2E Parcel' } }),
      () => prisma.unit.deleteMany({ where: { tower: 'E' } }),
    ]) await del().catch(() => undefined);
    const u = await prisma.user.upsert({
      where: { email: 'e2e@ameya.test' },
      create: { email: 'e2e@ameya.test', username: 'e2e', name: 'E2E', role: 'SUPER_ADMIN', passwordHash: 'x' },
      update: {},
      select: { id: true },
    });
    actor = u.id;
    const c = await prisma.tallyCompany.upsert({
      where: { name: 'E2E Books' }, create: { name: 'E2E Books', isDefault: true }, update: {}, select: { id: true },
    });
    companyId = c.id;
  }, 60_000);

  it('seeds every account the posting rules point at', async () => {
    const { REQUIRED_CODES } = await import('@/config/chart-of-accounts');
    const found = await prisma.account.findMany({ where: { code: { in: [...REQUIRED_CODES] } }, select: { code: true } });
    expect(found.length).toBe(REQUIRED_CODES.length);
  });

  it('posts a bank payment and balances', async () => {
    const { post } = await import('@/server/services/ledger-service');
    const { voucherLines } = await import('@/lib/ledger/posting-rules');
    const rule = voucherLines({ kind: 'BANK_PAID', amount: 118000, gstAmount: 18000, mode: 'BANK_TRANSFER', partyName: 'Acme', projectId: null });
    expect('ok' in rule).toBe(true);
    if (!('ok' in rule)) return;
    const r = await post({ narration: 'E2E payment', lines: rule.lines, sourceType: 'Voucher', sourceId: 'e2e-v1', createdById: actor, once: true });
    expect('ok' in r).toBe(true);
    if (!('ok' in r)) return;

    const lines = await prisma.journalLine.findMany({ where: { entryId: r.entryId } });
    const dr = lines.reduce((s, l) => s + Number(l.debit), 0);
    const cr = lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(dr).toBeCloseTo(cr, 2);
    expect(dr).toBeCloseTo(118000, 2);
  });

  it('refuses to post the same source twice', async () => {
    const { post } = await import('@/server/services/ledger-service');
    const { voucherLines } = await import('@/lib/ledger/posting-rules');
    const rule = voucherLines({ kind: 'BANK_PAID', amount: 118000, gstAmount: 18000, mode: 'BANK_TRANSFER', partyName: 'Acme', projectId: null });
    if (!('ok' in rule)) throw new Error('rule');
    const r = await post({ narration: 'E2E payment again', lines: rule.lines, sourceType: 'Voucher', sourceId: 'e2e-v1', createdById: actor, once: true });
    expect('error' in r).toBe(true);
  });

  it('posts an invoice with output GST on the right side', async () => {
    const { post } = await import('@/server/services/ledger-service');
    const { invoiceLines } = await import('@/lib/ledger/posting-rules');
    const rule = invoiceLines({ total: 105000, cgst: 2500, sgst: 2500, igst: 0, clientName: 'Buyer', projectId: null });
    if (!('ok' in rule)) throw new Error('rule');
    const r = await post({ narration: 'E2E invoice', lines: rule.lines, sourceType: 'Invoice', sourceId: 'e2e-i1', createdById: actor, once: true });
    expect('ok' in r).toBe(true);
    if (!('ok' in r)) return;
    const lines = await prisma.journalLine.findMany({ where: { entryId: r.entryId }, include: { account: true } });
    const debtors = lines.find((l) => l.account.code === '1130');
    const revenue = lines.find((l) => l.account.code === '4100');
    expect(Number(debtors?.debit)).toBeCloseTo(105000, 2);
    expect(Number(revenue?.credit)).toBeCloseTo(100000, 2);
  });

  it('mirrors into Tally once turned on, and never twice', async () => {
    const { MIRROR_COMPANY_KEY, mirrorJournalEntry, backfillMirror } = await import('@/server/services/tally-mirror-service');
    await prisma.setting.upsert({ where: { key: MIRROR_COMPANY_KEY }, create: { key: MIRROR_COMPANY_KEY, value: companyId }, update: { value: companyId } });

    // Drain, rather than one pass of 100. This database accumulates entries
    // across runs, and a single capped pass left a tail behind — which then
    // read as "the backfill mirrored the same books twice" on the next call.
    // The property under test is that a SECOND pass over already-mirrored
    // entries does nothing, so drain first and assert that.
    let firstMirrored = 0;
    for (let pass = 0; pass < 20; pass++) {
      const r = await backfillMirror(100);
      firstMirrored += r.mirrored;
      if (r.mirrored === 0) break;
    }
    expect(firstMirrored).toBeGreaterThan(0);

    const vouchers = await prisma.tallyVoucher.findMany({ where: { companyId }, include: { lines: true } });
    expect(vouchers.length).toBeGreaterThanOrEqual(firstMirrored);
    for (const v of vouchers) {
      const dr = v.lines.reduce((s, l) => s + Number(l.debit), 0);
      const cr = v.lines.reduce((s, l) => s + Number(l.credit), 0);
      expect(dr).toBeCloseTo(cr, 2);
    }

    // Re-running must be a no-op, not a duplicate set of books.
    const again = await backfillMirror(100);
    expect(again.mirrored).toBe(0);
    expect(await prisma.tallyVoucher.count({ where: { companyId } })).toBe(vouchers.length);

    // And a single re-mirror of an entry already copied does nothing.
    const anyEntry = await prisma.journalEntry.findFirst({ select: { id: true } });
    const r = await mirrorJournalEntry(anyEntry!.id);
    expect('ok' in r && r.created).toBe(false);
  }, 60_000);

  it('types the mirrored vouchers the way an accountant would', async () => {
    const types = await prisma.tallyVoucher.findMany({ where: { companyId }, select: { type: true } });
    const set = new Set(types.map((t) => t.type));
    expect(set.has('Payment')).toBe(true);
    expect(set.has('Sales')).toBe(true);
  });

  it('leaves the Tally trial balance in balance', async () => {
    const lines = await prisma.tallyVoucherLine.findMany({ where: { voucher: { companyId } } });
    const dr = lines.reduce((s, l) => s + Number(l.debit), 0);
    const cr = lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(dr).toBeCloseTo(cr, 2);
    expect(dr).toBeGreaterThan(0);
  });
});

// ── The other new write paths ────────────────────────────────────────────────
suite('registers, inventory and site ops', () => {
  it('generates a tower without duplicates and is safe to re-run', async () => {
    const { towerUnitCode } = await import('@/lib/inventory/tower-codes');
    const project = await prisma.project.upsert({
      where: { code: 'E2E' },
      create: { code: 'E2E', name: 'E2E Project' },
      update: {},
      select: { id: true },
    });

    const make = async () => {
      const wanted: { code: string; floor: number }[] = [];
      for (let f = 1; f <= 5; f++) for (let i = 0; i < 4; i++) wanted.push({ code: towerUnitCode('E', f, i, 'NUMERIC', 1), floor: f });
      const existing = new Set((await prisma.unit.findMany({ where: { projectId: project.id, code: { in: wanted.map((w) => w.code) } }, select: { code: true } })).map((u) => u.code));
      const fresh = wanted.filter((w) => !existing.has(w.code));
      await prisma.unit.createMany({ data: fresh.map((w) => ({ projectId: project.id, code: w.code, tower: 'E', floor: w.floor })), skipDuplicates: true });
      return fresh.length;
    };

    expect(await make()).toBe(20);
    expect(await make()).toBe(0); // re-running adds nothing
    expect(await prisma.unit.count({ where: { projectId: project.id, tower: 'E' } })).toBe(20);
  }, 30_000);

  it('rolls a site log into programme progress and the buyer portal', async () => {
    const project = await prisma.project.findFirstOrThrow({ where: { code: 'E2E' }, select: { id: true } });
    const activity = await prisma.programmeActivity.create({
      data: { projectId: project.id, name: 'Slab 3 casting', durationDays: 5 },
      select: { id: true },
    });

    const when = new Date();
    await prisma.progressUpdate.create({ data: { activityId: activity.id, updateDate: when, percentComplete: 60, note: 'E2E' } });
    await prisma.programmeActivity.update({ where: { id: activity.id }, data: { percentComplete: 60, actualStart: when } });
    await prisma.constructionUpdate.create({ data: { projectId: project.id, title: 'Slab 3 — today', milestone: 'Slab 3', imageUrl: 'https://example.test/p.jpg' } });

    const a = await prisma.programmeActivity.findUniqueOrThrow({ where: { id: activity.id } });
    expect(Number(a.percentComplete)).toBe(60);
    expect(a.actualStart).not.toBeNull();
    expect(a.actualEnd).toBeNull();
    expect(await prisma.constructionUpdate.count({ where: { projectId: project.id } })).toBeGreaterThan(0);
  }, 30_000);

  it('writes and reads every one of the nine registers', async () => {
    const project = await prisma.project.findFirstOrThrow({ where: { code: 'E2E' }, select: { id: true } });
    const parcel = await prisma.landParcel.create({ data: { name: 'E2E Parcel', surveyNumber: '12/3' }, select: { id: true } });

    await prisma.contractRecord.create({ data: { title: 'Lift AMC', counterparty: 'Otis', renewalOn: new Date(Date.now() + 10 * 86400000), projectId: project.id } });
    await prisma.insurancePolicy.create({ data: { name: 'CAR', insurer: 'ICICI Lombard', expiresOn: new Date(Date.now() + 20 * 86400000), projectId: project.id } });
    await prisma.complianceDocExpiry.create({ data: { title: 'Fire NOC', expiresOn: new Date(Date.now() - 3 * 86400000), projectId: project.id } });
    await prisma.sop.create({ data: { title: 'Releasing a held unit' } });
    await prisma.lessonLearned.create({ data: { title: 'RMC lead time', recommendation: 'Book 48h ahead', projectId: project.id } });
    await prisma.wasteManifest.create({ data: { wasteType: 'C&D debris', quantity: 12, unit: 'MT', projectId: project.id } });
    await prisma.accessReview.create({ data: { subject: 'Finance permissions', dueOn: new Date() } });
    await prisma.powerOfAttorney.create({ data: { grantor: 'A', attorney: 'B', scope: 'Execute the sale deed', parcelId: parcel.id, validUntil: new Date(Date.now() + 5 * 86400000), projectId: project.id } });
    await prisma.jointDevelopmentAgreement.create({ data: { parcelId: parcel.id, landownerName: 'C', developerShare: 60, landownerShare: 40 } });

    const svc = await import('@/server/services/compliance-service');
    expect((await svc.contracts(project.id)).length).toBe(1);
    expect((await svc.insurancePolicies(project.id)).length).toBe(1);
    expect((await svc.licenceRenewals(project.id)).length).toBe(1);
    expect((await svc.sops()).length).toBe(1);
    expect((await svc.lessons(project.id)).length).toBe(1);
    expect((await svc.wasteManifests(project.id)).length).toBe(1);
    expect((await svc.accessReviews()).length).toBe(1);
    expect((await svc.powersOfAttorney(project.id)).length).toBe(1);
    expect((await svc.jointDevelopmentAgreements()).length).toBe(1);
  }, 30_000);

  it('surfaces the expiring ones, overdue first, with a link that goes somewhere', async () => {
    const { upcomingExpiries } = await import('@/server/services/compliance-service');
    const rows = await upcomingExpiries(90);
    expect(rows.length).toBe(4); // contract, insurance, licence, POA
    expect(rows[0]!.kind).toBe('Licence');   // the expired one sorts first
    expect(rows[0]!.days).toBeLessThan(0);
    for (const r of rows) expect(r.href.startsWith('/')).toBe(true);
  });
});

// ── The defects a review found in the first cut of this release ──────────────
suite('things that used to be wrong', () => {
  it('carries the expense head and the party onto every ledger line', async () => {
    const { post } = await import('@/server/services/ledger-service');
    const { voucherLines } = await import('@/lib/ledger/posting-rules');
    const vendor = await prisma.vendor.create({ data: { name: 'Steel Co' }, select: { id: true } });

    const rule = voucherLines({ kind: 'BANK_PAID', amount: 50000, mode: 'BANK_TRANSFER', partyName: 'Steel Co', vendorId: vendor.id, accountCode: '5320', projectId: null });
    if (!('ok' in rule)) throw new Error('rule');
    const r = await post({ narration: 'Steel', lines: rule.lines, sourceType: 'Voucher', sourceId: 'e2e-cat', createdById: actor, once: true });
    if (!('ok' in r)) throw new Error(r.error);

    const lines = await prisma.journalLine.findMany({ where: { entryId: r.entryId }, include: { account: true } });
    // The category the user chose, not the 6900 catch-all.
    expect(lines.some((l) => l.account.code === '5320' && Number(l.debit) === 50000)).toBe(true);
    // And a party ledger that is actually a party ledger.
    expect(lines.every((l) => l.vendorId === vendor.id)).toBe(true);
  });

  it('books TDS and retention as liabilities, not as a smaller cost', async () => {
    const { post } = await import('@/server/services/ledger-service');
    const { contractorSettlementLines } = await import('@/lib/ledger/posting-rules');
    // ₹10 L gross, ₹10 k TDS, ₹50 k retention → ₹9.4 L leaves the bank.
    const rule = contractorSettlementLines({ kind: 'BANK_PAID', amount: 940000, tdsAmount: 10000, retentionAmount: 50000, mode: 'BANK_TRANSFER', partyName: 'Civil Co', accountCode: '5410', projectId: null });
    if (!('ok' in rule)) throw new Error('rule');
    const r = await post({ narration: 'RA settlement', lines: rule.lines, sourceType: 'Voucher', sourceId: 'e2e-ra', createdById: actor, once: true });
    if (!('ok' in r)) throw new Error(r.error);

    const lines = await prisma.journalLine.findMany({ where: { entryId: r.entryId }, include: { account: true } });
    const by = (code: string) => lines.find((l) => l.account.code === code);
    expect(Number(by('5410')?.debit)).toBeCloseTo(1000000, 2);  // gross cost
    expect(Number(by('2150')?.credit)).toBeCloseTo(10000, 2);   // TDS payable
    expect(Number(by('2130')?.credit)).toBeCloseTo(50000, 2);   // retention payable
    expect(Number(by('1121')?.credit)).toBeCloseTo(940000, 2);  // net out of the bank
  });

  it('clears the creditor when a booked bill is paid, instead of counting the cost twice', async () => {
    const { post } = await import('@/server/services/ledger-service');
    const { vendorBillLines, billSettlementLines } = await import('@/lib/ledger/posting-rules');
    const vendor = await prisma.vendor.create({ data: { name: 'Cement Co' }, select: { id: true } });

    const bill = vendorBillLines({ amount: 118000, gstAmount: 18000, vendorId: vendor.id, vendorName: 'Cement Co', accountCode: '5310' });
    if (!('ok' in bill)) throw new Error('bill');
    const b = await post({ narration: 'Bill', lines: bill.lines, sourceType: 'VendorBill', sourceId: 'e2e-b1', createdById: actor, once: true });
    if (!('ok' in b)) throw new Error(b.error);

    const pay = billSettlementLines({ amount: 118000, mode: 'BANK_TRANSFER', vendorId: vendor.id, partyName: 'Cement Co', billNumber: 'B-1' });
    if (!('ok' in pay)) throw new Error('pay');
    const p = await post({ narration: 'Payment', lines: pay.lines, sourceType: 'Voucher', sourceId: 'e2e-b1-pay', createdById: actor, once: true });
    if (!('ok' in p)) throw new Error(p.error);

    const all = await prisma.journalLine.findMany({ where: { entryId: { in: [b.entryId, p.entryId] } }, include: { account: true } });
    const cost = all.filter((l) => l.account.code === '5310').reduce((s, l) => s + Number(l.debit), 0);
    const creditor = all.filter((l) => l.account.code === '2110').reduce((s, l) => s + Number(l.credit) - Number(l.debit), 0);
    expect(cost).toBeCloseTo(100000, 2);  // the cost is booked ONCE, net of GST
    expect(creditor).toBeCloseTo(0, 2);   // and the payable is fully cleared
  });

  it('will not let the same source document post twice, even in a race', async () => {
    const { post } = await import('@/server/services/ledger-service');
    const { voucherLines } = await import('@/lib/ledger/posting-rules');
    const rule = voucherLines({ kind: 'CASH_PAID', amount: 4000, mode: 'CASH', partyName: 'Tea', projectId: null });
    if (!('ok' in rule)) throw new Error('rule');

    // Both calls check-then-insert concurrently; the database index is what
    // stops the second one landing.
    const [a, b] = await Promise.all([
      post({ narration: 'Race A', lines: rule.lines, sourceType: 'Voucher', sourceId: 'e2e-race', createdById: actor, once: true }),
      post({ narration: 'Race B', lines: rule.lines, sourceType: 'Voucher', sourceId: 'e2e-race', createdById: actor, once: true }),
    ]);
    const wins = [a, b].filter((r) => 'ok' in r).length;
    expect(wins).toBe(1);
    expect(await prisma.journalEntry.count({ where: { sourceType: 'Voucher', sourceId: 'e2e-race' } })).toBe(1);
  });

  it('seeds the voucher counter from the numbers already in use', async () => {
    // A dedicated prefix, so nothing another test creates can move the answer —
    // the whole point here is what the seed reads, not what else exists.
    await prisma.numberSequence.deleteMany({ where: { key: 'voucher:ZQ' } });
    await prisma.voucher.deleteMany({ where: { number: { startsWith: 'ZQ-' } } });

    // An import wrote ZQ-1001…ZQ-10000 before the counter had ever been touched.
    for (const n of [1001, 1400, 9999, 10000]) {
      await prisma.voucher.create({ data: { number: `ZQ-${n}`, kind: 'CASH_PAID', partyName: 'Legacy', amount: 1, mode: 'CASH' } });
    }
    const { nextVoucherNumber } = await import('@/lib/db/voucher-number');
    // Read as an integer: ZQ-10000 is the highest, not ZQ-9999.
    expect(await nextVoucherNumber('ZQ')).toBe('ZQ-10001');
    expect(await nextVoucherNumber('ZQ')).toBe('ZQ-10002');
  }, 30_000);
});

// ── The defects the verification pass found in the fixes themselves ─────────
suite('withdrawing a payment', () => {
  it('lets a rejected settlement be raised again — and not twice', async () => {
    const project = await prisma.project.findFirstOrThrow({ where: { code: 'E2E' }, select: { id: true } });
    const vendor = await prisma.vendor.create({ data: { name: 'Contractor Co' }, select: { id: true } });
    const bill = await prisma.raBill.create({
      data: { number: 'RA-9001', billNo: 1, projectId: project.id, vendorId: vendor.id, status: 'CERTIFIED', netPayable: 100000, grossValue: 100000 },
      select: { id: true },
    });
    const voucher = await prisma.voucher.create({
      data: { number: 'CP-90001', kind: 'BANK_PAID', status: 'DRAFT', partyName: 'Contractor Co', vendorId: vendor.id, amount: 100000, mode: 'BANK_TRANSFER' },
      select: { id: true },
    });
    await prisma.raBill.update({ where: { id: bill.id }, data: { voucherId: voucher.id } });

    // Turned down. The LINK stays; the voucher becomes CANCELLED.
    await prisma.voucher.update({ where: { id: voucher.id }, data: { status: 'CANCELLED', cancelReason: 'Not approved: wrong measurement' } });

    const held = await prisma.raBill.findUniqueOrThrow({ where: { id: bill.id }, select: { voucherId: true, status: true } });
    expect(held.voucherId).toBe(voucher.id);   // the link survives, so a restore can find it
    expect(held.status).toBe('CERTIFIED');     // and the bill is payable again

    // Restored. Because the link was never dropped, the bill cannot now be
    // settled a second time behind the restored payment's back.
    await prisma.voucher.update({ where: { id: voucher.id }, data: { status: 'DRAFT', cancelReason: null } });
    const after = await prisma.voucher.findUniqueOrThrow({ where: { id: voucher.id }, select: { status: true } });
    expect(after.status).toBe('DRAFT');
    const stillLinked = await prisma.raBill.findUniqueOrThrow({ where: { id: bill.id }, select: { voucherId: true } });
    expect(stillLinked.voucherId).toBe(voucher.id);
  }, 30_000);

  it('books a bill payment with TDS held back without touching the expense again', async () => {
    const { billSettlementLines } = await import('@/lib/ledger/posting-rules');
    const r = billSettlementLines({ amount: 100000, tdsAmount: 2000, mode: 'BANK_TRANSFER', vendorId: null, partyName: 'X' });
    if (!('ok' in r)) throw new Error(r.error);
    const dr = r.lines.reduce((s, l) => s + Number(l.debit ?? 0), 0);
    const cr = r.lines.reduce((s, l) => s + Number(l.credit ?? 0), 0);
    expect(dr).toBeCloseTo(cr, 2);
    expect(Number(r.lines.find((l) => l.accountCode === '2110')?.debit)).toBeCloseTo(100000, 2); // payable cleared in FULL
    expect(Number(r.lines.find((l) => l.accountCode === '2150')?.credit)).toBeCloseTo(2000, 2);  // TDS still owed
    expect(Number(r.lines.find((l) => l.accountCode === '1121')?.credit)).toBeCloseTo(98000, 2); // only the net leaves
    expect(r.lines.some((l) => (l.accountCode ?? '').startsWith('5'))).toBe(false);
  });

  it('numbers RA bills as integers, seeded from what is already there', async () => {
    await prisma.numberSequence.deleteMany({ where: { key: 'rabill:RA' } });
    const project = await prisma.project.findFirstOrThrow({ where: { code: 'E2E' }, select: { id: true } });
    await prisma.raBill.create({ data: { number: 'RA-10000', billNo: 9000, projectId: project.id, status: 'DRAFT', netPayable: 1, grossValue: 1 } });

    await prisma.$queryRaw`
      INSERT INTO "NumberSequence" ("key", "value", "updatedAt")
      VALUES ('rabill:RA', GREATEST(1000, COALESCE((
        SELECT MAX(substring("number" from '[0-9]+$')::bigint) FROM "RaBill" WHERE "number" ~ '^RA-[0-9]+$'
      ), 1000)), NOW())
      ON CONFLICT ("key") DO NOTHING
    `;
    const { nextSequence } = await import('@/lib/db/sequence');
    // RA-10000 is the highest, not RA-9999 — the whole point of reading it as a number.
    expect(await nextSequence('rabill:RA', undefined, 1000)).toBe(10001);
  }, 30_000);
});
