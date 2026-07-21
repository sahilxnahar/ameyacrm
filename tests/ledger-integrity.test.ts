import { describe, it, expect } from 'vitest';
import { checkEntry, toPaise, rupees } from '@/lib/ledger/entry';
import { voucherLines, vendorBillLines, invoiceLines } from '@/lib/ledger/posting-rules';
import { CHART_OF_ACCOUNTS, normalSide, REQUIRED_CODES } from '@/config/chart-of-accounts';

describe('the chart of accounts holds together', () => {
  it('has no duplicate codes', () => {
    const codes = CHART_OF_ACCOUNTS.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('every parent exists and is a group', () => {
    const byCode = new Map(CHART_OF_ACCOUNTS.map((a) => [a.code, a]));
    for (const a of CHART_OF_ACCOUNTS) {
      if (!a.parent) continue;
      const p = byCode.get(a.parent);
      expect(p, `${a.code} points at a parent that does not exist`).toBeDefined();
      expect(p!.isGroup, `${a.code}'s parent ${a.parent} is not a heading`).toBe(true);
    }
  });

  it('a child never contradicts its parent type', () => {
    const byCode = new Map(CHART_OF_ACCOUNTS.map((a) => [a.code, a]));
    for (const a of CHART_OF_ACCOUNTS) {
      if (!a.parent) continue;
      expect(byCode.get(a.parent)!.type, `${a.code} sits under a ${byCode.get(a.parent)!.type}`).toBe(a.type);
    }
  });

  it('every account the posting rules need exists, and takes postings', () => {
    const byCode = new Map(CHART_OF_ACCOUNTS.map((a) => [a.code, a]));
    for (const code of REQUIRED_CODES) {
      const a = byCode.get(code);
      expect(a, `posting rules need account ${code}`).toBeDefined();
      expect(a!.isGroup, `${code} is a heading and cannot be posted to`).toBeFalsy();
    }
  });

  it('sides follow the type', () => {
    expect(normalSide('ASSET')).toBe('DEBIT');
    expect(normalSide('EXPENSE')).toBe('DEBIT');
    expect(normalSide('LIABILITY')).toBe('CREDIT');
    expect(normalSide('INCOME')).toBe('CREDIT');
    expect(normalSide('EQUITY')).toBe('CREDIT');
  });
});

describe('no posting rule can produce an unbalanced entry', () => {
  const codes = new Set(CHART_OF_ACCOUNTS.filter((a) => !a.isGroup).map((a) => a.code));

  /**
   * A sweep rather than a handful of examples. Rounding bugs in a GST split
   * do not appear on round numbers — they appear on 33,333.33, which is
   * exactly the sort of figure a real bill carries.
   */
  const amounts = [1, 7, 99.99, 100.01, 333.33, 33333.33, 66666.67, 123456.78, 9999999.99];
  const rates = [0, 5, 12, 18, 28];

  it('vouchers of every kind, amount and rate', () => {
    const kinds = ['CASH_RECEIVED', 'BANK_RECEIVED', 'CASH_PAID', 'BANK_PAID', 'MATERIAL_RECEIVED', 'MATERIAL_ISSUED'];
    let checked = 0;
    for (const kind of kinds) {
      for (const base of amounts) {
        for (const rate of rates) {
          const gst = Math.round(base * (rate / 100) * 100) / 100;
          const gross = Math.round((base + gst) * 100) / 100;
          const r = voucherLines({ kind, amount: gross, gstAmount: gst, mode: 'BANK' });
          if ('error' in r) throw new Error(`${kind} ${gross}/${gst}: ${r.error}`);
          const c = checkEntry(r.lines);
          if (!c.ok) throw new Error(`${kind} ${gross}/${gst}: ${c.error}`);
          expect(c.entry.totalPaise).toBe(toPaise(gross));
          for (const l of r.lines) expect(codes.has(l.accountCode), `unknown account ${l.accountCode}`).toBe(true);
          checked++;
        }
      }
    }
    expect(checked).toBe(kinds.length * amounts.length * rates.length);
  });

  it('vendor bills of every amount and rate', () => {
    for (const base of amounts) {
      for (const rate of rates) {
        const gst = Math.round(base * (rate / 100) * 100) / 100;
        const gross = Math.round((base + gst) * 100) / 100;
        const r = vendorBillLines({ amount: gross, gstAmount: gst, accountCode: '5410' });
        if ('error' in r) throw new Error(r.error);
        expect(checkEntry(r.lines).ok).toBe(true);
      }
    }
  });

  it('invoices of every amount and tax split', () => {
    for (const base of amounts) {
      for (const rate of rates) {
        const tax = Math.round(base * (rate / 100) * 100) / 100;
        const half = Math.round((tax / 2) * 100) / 100;
        const other = Math.round((tax - half) * 100) / 100;
        const r = invoiceLines({ total: Math.round((base + tax) * 100) / 100, cgst: half, sgst: other });
        if ('error' in r) throw new Error(r.error);
        expect(checkEntry(r.lines).ok).toBe(true);
      }
    }
  });

  it('a thousand random amounts still balance to the paisa', () => {
    for (let i = 0; i < 1000; i++) {
      const base = Math.round(Math.random() * 5_000_000 * 100) / 100;
      const rate = [0, 5, 12, 18, 28][i % 5]!;
      const gst = Math.round(base * (rate / 100) * 100) / 100;
      const gross = Math.round((base + gst) * 100) / 100;
      const r = voucherLines({ kind: 'BANK_PAID', amount: gross, gstAmount: gst, accountCode: '5310' });
      if ('error' in r) throw new Error(r.error);
      const c = checkEntry(r.lines);
      if (!c.ok) throw new Error(`${gross} / ${gst}: ${c.error}`);
      expect(rupees(c.entry.totalPaise)).toBe(gross);
    }
  });
});
