import { describe, it, expect } from 'vitest';
import { contractorSettlementLines, billSettlementLines, voucherLines } from '@/lib/ledger/posting-rules';

const sum = (lines: { debit?: number | string; credit?: number | string }[], k: 'debit' | 'credit') =>
  lines.reduce((s, l) => s + Number(l[k] ?? 0), 0);

describe('contractor settlement with money held back', () => {
  const rule = contractorSettlementLines({
    kind: 'BANK_PAID', amount: 940000, tdsAmount: 10000, retentionAmount: 50000,
    mode: 'BANK_TRANSFER', partyName: 'Civil Co', accountCode: '5410', projectId: null,
  });

  it('balances', () => {
    if (!('ok' in rule)) throw new Error(rule.error);
    expect(sum(rule.lines, 'debit')).toBeCloseTo(sum(rule.lines, 'credit'), 2);
  });

  it('books the gross as cost, not the net', () => {
    if (!('ok' in rule)) throw new Error(rule.error);
    const cost = rule.lines.find((l) => l.accountCode === '5410');
    expect(Number(cost?.debit)).toBeCloseTo(1000000, 2);
  });

  it('leaves the TDS and the retention standing as liabilities', () => {
    if (!('ok' in rule)) throw new Error(rule.error);
    expect(Number(rule.lines.find((l) => l.accountCode === '2150')?.credit)).toBeCloseTo(10000, 2);
    expect(Number(rule.lines.find((l) => l.accountCode === '2130')?.credit)).toBeCloseTo(50000, 2);
  });

  it('takes only the net out of the bank', () => {
    if (!('ok' in rule)) throw new Error(rule.error);
    expect(Number(rule.lines.find((l) => l.accountCode === '1121')?.credit)).toBeCloseTo(940000, 2);
  });

  it('falls back to the ordinary rule when nothing is held back', () => {
    const plain = contractorSettlementLines({ kind: 'BANK_PAID', amount: 5000, mode: 'BANK_TRANSFER', partyName: 'X', projectId: null });
    const ordinary = voucherLines({ kind: 'BANK_PAID', amount: 5000, mode: 'BANK_TRANSFER', partyName: 'X', projectId: null });
    expect(JSON.stringify(plain)).toBe(JSON.stringify(ordinary));
  });
});

describe('paying a bill that is already in the books', () => {
  it('clears the payable and does not touch the expense again', () => {
    const r = billSettlementLines({ amount: 118000, mode: 'BANK_TRANSFER', vendorId: 'v1', partyName: 'Cement Co', billNumber: 'B-1' });
    if (!('ok' in r)) throw new Error(r.error);
    expect(r.lines).toHaveLength(2);
    expect(Number(r.lines.find((l) => l.accountCode === '2110')?.debit)).toBeCloseTo(118000, 2);
    expect(Number(r.lines.find((l) => l.accountCode === '1121')?.credit)).toBeCloseTo(118000, 2);
    expect(r.lines.some((l) => (l.accountCode ?? '').startsWith('5'))).toBe(false);
  });

  it('refuses an empty payment', () => {
    expect('error' in billSettlementLines({ amount: 0 })).toBe(true);
  });
});

describe('BOCW labour cess', () => {
  it('is a liability withheld, not a smaller cost', () => {
    // ₹10 L certified: 1% cess ₹10 k, 5% retention ₹50 k, 1% TDS ₹10 k → ₹9.3 L out.
    const r = contractorSettlementLines({
      kind: 'BANK_PAID', amount: 930000, tdsAmount: 10000, retentionAmount: 50000, cessAmount: 10000,
      mode: 'BANK_TRANSFER', partyName: 'Civil Co', accountCode: '5410', projectId: null,
    });
    if (!('ok' in r)) throw new Error(r.error);
    expect(sum(r.lines, 'debit')).toBeCloseTo(sum(r.lines, 'credit'), 2);
    expect(Number(r.lines.find((l) => l.accountCode === '5410')?.debit)).toBeCloseTo(1000000, 2);
    expect(Number(r.lines.find((l) => l.accountCode === '2155')?.credit)).toBeCloseTo(10000, 2);
    expect(Number(r.lines.find((l) => l.accountCode === '1121')?.credit)).toBeCloseTo(930000, 2);
  });

  it('takes the contractor rule even when cess is the only deduction', () => {
    const r = contractorSettlementLines({ kind: 'BANK_PAID', amount: 99000, cessAmount: 1000, mode: 'BANK_TRANSFER', partyName: 'X', projectId: null });
    if (!('ok' in r)) throw new Error(r.error);
    expect(r.lines.some((l) => l.accountCode === '2155')).toBe(true);
  });
});
