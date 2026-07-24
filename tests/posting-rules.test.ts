import { describe, it, expect } from 'vitest';
import { voucherLines, vendorBillLines, invoiceLines, moneyAccount } from '@/lib/ledger/posting-rules';
import { checkEntry } from '@/lib/ledger/entry';

/** Every rule must produce something the ledger will accept. */
const mustBalance = (r: ReturnType<typeof voucherLines>) => {
  if ('error' in r) throw new Error(`rule failed: ${r.error}`);
  const c = checkEntry(r.lines);
  if (!c.ok) throw new Error(`does not balance: ${c.error}`);
  return c.entry;
};

describe('voucher posting', () => {
  it('books a receipt as an advance, not as income', () => {
    const r = voucherLines({ kind: 'BANK_RECEIVED', amount: 500000, mode: 'BANK' });
    mustBalance(r);
    if ('error' in r) return;
    expect(r.lines.find((l) => l.credit)?.accountCode).toBe('2120');
    expect(r.lines.some((l) => l.accountCode === '4100')).toBe(false);
  });

  it('sends cash to cash and bank to bank', () => {
    expect(moneyAccount('CASH')).toBe('1110');
    expect(moneyAccount('BANK')).toBe('1121');
    expect(moneyAccount(null)).toBe('1121');
  });

  it('splits GST out of a payment instead of burying it in the cost', () => {
    const r = voucherLines({ kind: 'BANK_PAID', amount: 118000, gstAmount: 18000, accountCode: '5310' });
    mustBalance(r);
    if ('error' in r) return;
    const cost = r.lines.find((l) => l.accountCode === '5310');
    expect(Number(cost?.debit)).toBe(100000);
    expect(r.lines.filter((l) => l.accountCode === '1151' || l.accountCode === '1152')).toHaveLength(2);
  });

  it('splits an odd GST amount without losing a paisa', () => {
    // 15,000.01 halves to 7,500.005 — the case that loses money if rounded twice.
    const r = voucherLines({ kind: 'BANK_PAID', amount: 115000.01, gstAmount: 15000.01, accountCode: '5310' });
    const entry = mustBalance(r);
    expect(entry.totalPaise).toBe(11500001);
    if ('error' in r) return;
    const gstTotal = r.lines
      .filter((l) => l.accountCode === '1151' || l.accountCode === '1152')
      .reduce((a, l) => a + Number(l.debit), 0);
    expect(Math.round(gstTotal * 100)).toBe(1500001);
  });

  it('books material received as a cost and a liability', () => {
    const r = voucherLines({ kind: 'MATERIAL_RECEIVED', amount: 50000, accountCode: '5320' });
    mustBalance(r);
    if ('error' in r) return;
    expect(r.lines.some((l) => l.accountCode === '2110' && l.credit)).toBe(true);
  });

  it('moves material to work in progress without touching profit', () => {
    const r = voucherLines({ kind: 'MATERIAL_ISSUED', amount: 50000, accountCode: '5320' });
    mustBalance(r);
    if ('error' in r) return;
    expect(r.lines.some((l) => l.accountCode === '1220' && l.debit)).toBe(true);
  });

  it('refuses a voucher with no amount', () => {
    expect(voucherLines({ kind: 'BANK_PAID', amount: 0 })).toHaveProperty('error');
    expect(voucherLines({ kind: 'BANK_PAID', amount: 'abc' })).toHaveProperty('error');
  });

  it('refuses GST larger than the voucher', () => {
    expect(voucherLines({ kind: 'BANK_PAID', amount: 1000, gstAmount: 2000 })).toHaveProperty('error');
  });

  it('refuses a kind it has no rule for', () => {
    expect(voucherLines({ kind: 'TELEPORTED', amount: 100 })).toHaveProperty('error');
  });

  it('balances across a wide range of amounts and GST rates', () => {
    for (const base of [1, 99.99, 12345.67, 987654.32, 15000000]) {
      for (const rate of [0, 0.05, 0.12, 0.18, 0.28]) {
        const gst = Math.round(base * rate * 100) / 100;
        const r = voucherLines({ kind: 'BANK_PAID', amount: Math.round((base + gst) * 100) / 100, gstAmount: gst, accountCode: '5310' });
        mustBalance(r);
      }
    }
  });
});

describe('vendor bill posting', () => {
  it('balances and lands on payables', () => {
    const r = vendorBillLines({ amount: 236000, gstAmount: 36000, accountCode: '5410', vendorName: 'SV Enterprises' });
    mustBalance(r);
    if ('error' in r) return;
    expect(r.lines.find((l) => l.credit)?.accountCode).toBe('2110');
  });

  it('refuses nonsense', () => {
    expect(vendorBillLines({ amount: -5 })).toHaveProperty('error');
  });
});

describe('invoice posting', () => {
  it('splits net revenue from output tax', () => {
    const r = invoiceLines({ total: 1180000, cgst: 90000, sgst: 90000, clientName: 'A Buyer' });
    mustBalance(r);
    if ('error' in r) return;
    expect(Number(r.lines.find((l) => l.accountCode === '4100')?.credit)).toBe(1000000);
    expect(Number(r.lines.find((l) => l.accountCode === '1130')?.debit)).toBe(1180000);
  });

  it('handles an inter-state invoice with IGST', () => {
    const r = invoiceLines({ total: 118000, igst: 18000 });
    mustBalance(r);
    if ('error' in r) return;
    expect(r.lines.some((l) => l.accountCode === '2143')).toBe(true);
  });

  it('handles an invoice with no tax at all', () => {
    mustBalance(invoiceLines({ total: 50000 }));
  });

  it('refuses tax larger than the invoice', () => {
    expect(invoiceLines({ total: 1000, cgst: 900, sgst: 900 })).toHaveProperty('error');
  });
});
