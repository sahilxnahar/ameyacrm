import { describe, it, expect } from 'vitest';
import { parsePaymentAmount, parsePaymentDate, paymentMode, classifyPaymentRow } from '@/lib/import/payments';

describe('payment import parsing (H5 robust imports)', () => {
  it('reads amounts from messy currency text', () => {
    expect(parsePaymentAmount('₹1,20,000')).toBe(120000);
    expect(parsePaymentAmount('50000')).toBe(50000);
    expect(parsePaymentAmount('1.5')).toBe(1.5);
    expect(parsePaymentAmount('abc')).toBe(0);
    expect(parsePaymentAmount('')).toBe(0);
  });

  it('reads dd/mm/yyyy and dd-mm-yy dates', () => {
    expect(parsePaymentDate('15/03/2026')?.getFullYear()).toBe(2026);
    expect(parsePaymentDate('15/03/2026')?.getMonth()).toBe(2); // March
    expect(parsePaymentDate('01-04-26')?.getFullYear()).toBe(2026);
    expect(parsePaymentDate('')).toBeNull();
    expect(parsePaymentDate('not a date')).toBeNull();
  });

  it('maps payment modes, defaulting to bank transfer', () => {
    expect(paymentMode('Cash')).toBe('CASH');
    expect(paymentMode('paid by UPI')).toBe('UPI');
    expect(paymentMode('Cheque no 123')).toBe('CHEQUE');
    expect(paymentMode('NEFT')).toBe('BANK_TRANSFER');
    expect(paymentMode('')).toBe('BANK_TRANSFER');
  });

  it('classifies blank, bad-amount and valid rows', () => {
    expect(classifyPaymentRow('', '5000')).toEqual({ kind: 'blank' });
    expect(classifyPaymentRow('   ', '5000')).toEqual({ kind: 'blank' });
    expect(classifyPaymentRow('Arun', 'zero')).toMatchObject({ kind: 'badAmount', name: 'Arun' });
    expect(classifyPaymentRow('Arun', '0')).toMatchObject({ kind: 'badAmount' });
    expect(classifyPaymentRow('Arun', '₹5,000')).toEqual({ kind: 'ok', name: 'Arun', amount: 5000 });
  });

  it('treats a negative amount as a bad amount, never a payment', () => {
    expect(classifyPaymentRow('Arun', '-500').kind).toBe('badAmount');
  });
});
