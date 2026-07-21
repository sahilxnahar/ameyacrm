import { describe, it, expect } from 'vitest';
import { checkEntry, toPaise, rupees, reverseLines, signedBalance } from '@/lib/ledger/entry';

const line = (accountCode: string, debit?: number, credit?: number) => ({ accountCode, debit, credit });

describe('toPaise', () => {
  it('converts rupees exactly, including the awkward ones', () => {
    expect(toPaise(0.1)).toBe(10);
    expect(toPaise(0.2)).toBe(20);
    expect(toPaise(1.15)).toBe(115);
    expect(toPaise(2.675)).toBe(268);       // rounds, does not truncate to 267
    expect(toPaise(350000)).toBe(35000000);
    expect(toPaise('₹3,50,000.50')).toBe(35000050);
    expect(toPaise(null)).toBe(0);
  });

  it('refuses nonsense rather than quietly returning zero', () => {
    expect(toPaise('abc')).toBeNull();
  });

  it('survives a round trip', () => {
    for (const v of [0.01, 0.1, 1.15, 99999.99, 12345678.9]) {
      expect(rupees(toPaise(v)!)).toBeCloseTo(v, 2);
    }
  });

  it('does not drift when a hundred small amounts are added up', () => {
    // The float version of this famously lands on 0.9999999999999999.
    let paise = 0;
    for (let i = 0; i < 100; i++) paise += toPaise(0.01)!;
    expect(paise).toBe(100);
    expect(rupees(paise)).toBe(1);
  });
});

describe('checkEntry', () => {
  it('accepts a balanced entry', () => {
    const r = checkEntry([line('5310', 10000), line('1110', undefined, 10000)]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.entry.totalPaise).toBe(1000000);
  });

  it('refuses an unbalanced entry and says by how much', () => {
    const r = checkEntry([line('5310', 10000), line('1110', undefined, 9000)]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('1,000');
  });

  it('refuses a difference of a single paisa', () => {
    const r = checkEntry([line('5310', 100.01), line('1110', undefined, 100)]);
    expect(r.ok).toBe(false);
  });

  it('refuses a one-sided entry', () => {
    expect(checkEntry([line('5310', 100)]).ok).toBe(false);
  });

  it('refuses a line that is both debit and credit', () => {
    expect(checkEntry([{ accountCode: '5310', debit: 100, credit: 100 }, line('1110', undefined, 100)]).ok).toBe(false);
  });

  it('refuses negative amounts', () => {
    expect(checkEntry([line('5310', -100), line('1110', undefined, -100)]).ok).toBe(false);
  });

  it('refuses an empty line', () => {
    expect(checkEntry([line('5310', 100), line('1110', undefined, 100), line('1121')]).ok).toBe(false);
  });

  it('refuses an entry for nothing', () => {
    expect(checkEntry([line('5310', 0), line('1110', undefined, 0)]).ok).toBe(false);
  });

  it('handles a many-sided entry, such as a bill with GST', () => {
    const r = checkEntry([
      line('5310', 100000),          // material
      line('1151', 9000),            // input CGST
      line('1152', 9000),            // input SGST
      line('2110', undefined, 118000), // payable to vendor
    ]);
    expect(r.ok).toBe(true);
  });

  it('catches the classic GST rounding mistake', () => {
    // 18% of 1,00,000 split as two halves of 9,000 is fine; splitting 15,000.50
    // is where a paisa goes missing if anyone truncates.
    const r = checkEntry([
      line('5310', 83336.11),
      line('1151', 7500.25),
      line('1152', 7500.25),
      line('2110', undefined, 98336.61),
    ]);
    expect(r.ok).toBe(true);
  });
});

describe('reverseLines', () => {
  it('turns every debit into a credit and stays balanced', () => {
    const r = checkEntry([line('5310', 10000), line('1110', undefined, 10000)]);
    if (!r.ok) throw new Error('setup failed');
    const back = reverseLines(r.entry.lines);
    expect(back[0]!.creditPaise).toBe(1000000);
    expect(back[1]!.debitPaise).toBe(1000000);
    const sum = back.reduce((a, l) => a + l.debitPaise - l.creditPaise, 0);
    expect(sum).toBe(0);
  });
});

describe('signedBalance', () => {
  it('reads positive for a normal balance on either side', () => {
    expect(signedBalance('ASSET', 5000, 1000)).toBe(4000);
    expect(signedBalance('EXPENSE', 5000, 0)).toBe(5000);
    expect(signedBalance('LIABILITY', 1000, 5000)).toBe(4000);
    expect(signedBalance('INCOME', 0, 5000)).toBe(5000);
    expect(signedBalance('EQUITY', 0, 5000)).toBe(5000);
  });

  it('goes negative when an account is the wrong way round, rather than hiding it', () => {
    expect(signedBalance('ASSET', 0, 5000)).toBe(-5000);
  });
});
