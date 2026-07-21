import { describe, it, expect } from 'vitest';
import { reconcile, parseStatementCsv, type StatementLineInput, type VoucherCandidate } from '@/lib/treasury/reconcile';

const line = (o: Partial<StatementLineInput> & { id: string; amount: number }): StatementLineInput => ({
  id: o.id, date: o.date ?? new Date('2026-07-21T00:00:00Z'), amount: o.amount,
  refNo: o.refNo ?? null, description: o.description ?? '',
});
const vch = (o: Partial<VoucherCandidate> & { id: string; amount: number; direction: 'IN' | 'OUT' }): VoucherCandidate => ({
  id: o.id, number: o.number ?? o.id, utr: o.utr ?? null, amount: o.amount,
  date: o.date ?? new Date('2026-07-21T00:00:00Z'), partyName: o.partyName ?? 'X', direction: o.direction,
});

describe('reconcile', () => {
  it('matches on an exact UTR regardless of amount or date', () => {
    const r = reconcile(
      [line({ id: 'L1', amount: 150000, refNo: 'NEFT-UTR123456789', description: 'inward' })],
      [vch({ id: 'V1', amount: 150000, direction: 'IN', utr: 'utr123456789' })],
    );
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0]!.confidence).toBe('EXACT_UTR');
    expect(r.unmatchedLineIds).toHaveLength(0);
    expect(r.unmatchedVoucherIds).toHaveLength(0);
  });

  it('does not match a credit line to a payment voucher even at the same amount', () => {
    const r = reconcile(
      [line({ id: 'L1', amount: 50000 })], // credit (money in)
      [vch({ id: 'V1', amount: 50000, direction: 'OUT' })], // a payment
    );
    expect(r.matches).toHaveLength(0);
    expect(r.unmatchedLineIds).toEqual(['L1']);
  });

  it('matches by amount, direction and date proximity when there is no UTR', () => {
    const r = reconcile(
      [line({ id: 'L1', amount: -75000, date: new Date('2026-07-20T00:00:00Z') })], // debit
      [vch({ id: 'V1', amount: 75000, direction: 'OUT', date: new Date('2026-07-21T00:00:00Z') })],
    );
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0]!.confidence).toBe('AMOUNT_DATE');
    expect(r.matches[0]!.dayGap).toBe(1);
  });

  it('does not match by amount when the dates are too far apart', () => {
    const r = reconcile(
      [line({ id: 'L1', amount: -75000, date: new Date('2026-07-01T00:00:00Z') })],
      [vch({ id: 'V1', amount: 75000, direction: 'OUT', date: new Date('2026-07-21T00:00:00Z') })],
    );
    expect(r.matches).toHaveLength(0);
  });

  it('consumes each voucher once — two identical lines do not both take one voucher', () => {
    const r = reconcile(
      [line({ id: 'L1', amount: -1000 }), line({ id: 'L2', amount: -1000 })],
      [vch({ id: 'V1', amount: 1000, direction: 'OUT' })],
    );
    expect(r.matches).toHaveLength(1);
    expect(r.unmatchedLineIds).toHaveLength(1);
  });

  it('breaks amount ties by the smallest date gap', () => {
    const r = reconcile(
      [line({ id: 'L1', amount: 1000, date: new Date('2026-07-21T00:00:00Z') })],
      [
        vch({ id: 'Vfar', number: 'A', amount: 1000, direction: 'IN', date: new Date('2026-07-24T00:00:00Z') }),
        vch({ id: 'Vnear', number: 'B', amount: 1000, direction: 'IN', date: new Date('2026-07-22T00:00:00Z') }),
      ],
    );
    expect(r.matches[0]!.voucherId).toBe('Vnear');
  });
});

describe('parseStatementCsv', () => {
  it('parses withdrawal/deposit columns and signs them', () => {
    const csv = [
      'Date,Narration,Ref,Withdrawal,Deposit,Balance',
      '21/07/2026,NEFT inward,UTR999,,150000,150000',
      '22/07/2026,Cheque paid,CHQ12,50000,,100000',
    ].join('\n');
    const r = parseStatementCsv(csv);
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0]!.amount).toBe(150000);
    expect(r.lines[1]!.amount).toBe(-50000);
    expect(r.lines[0]!.refNo).toBe('UTR999');
  });

  it('handles a single signed Amount column and Indian-formatted numbers', () => {
    const csv = ['Txn Date,Description,Amount', '2026-07-21,Payment,"-1,50,000.00"'].join('\n');
    const r = parseStatementCsv(csv);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]!.amount).toBe(-150000);
  });

  it('does not bind a Credit/Debit column to a "Description" header (cr/dr substring collision)', () => {
    // Regression: "description" contains "cr", "address" contains "dr". A bare
    // 2-letter alias must not steal the money column, or every deposit vanishes.
    const csv = [
      'Date,Description,Address,Debit,Credit,Balance',
      '21/07/2026,NEFT inward from buyer,Bangalore,,150000,150000',
      '22/07/2026,Cheque to vendor,Chennai,50000,,100000',
    ].join('\n');
    const r = parseStatementCsv(csv);
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0]!.amount).toBe(150000);  // credit read correctly
    expect(r.lines[1]!.amount).toBe(-50000);  // debit read correctly
    expect(r.skipped).toHaveLength(0);
  });

  it('still matches a bank export that uses bare "Dr"/"Cr" columns', () => {
    const csv = ['Date,Narration,Dr,Cr', '21/07/2026,inward,,90000'].join('\n');
    const r = parseStatementCsv(csv);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]!.amount).toBe(90000);
  });

  it('skips rows it cannot read rather than dropping them silently', () => {
    const csv = ['Date,Narration,Amount', 'not-a-date,junk,100', '21/07/2026,ok,500'].join('\n');
    const r = parseStatementCsv(csv);
    expect(r.lines).toHaveLength(1);
    expect(r.skipped).toHaveLength(1);
  });
});
