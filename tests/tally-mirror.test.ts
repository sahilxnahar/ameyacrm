import { describe, it, expect } from 'vitest';
import { tallyGroupFor, tallyTypeFor } from '@/server/services/tally-mirror-service';

describe('CRM account → Tally group', () => {
  it('puts cash and bank where Tally expects them', () => {
    expect(tallyGroupFor('1110', 'ASSET')).toBe('Cash-in-Hand');
    expect(tallyGroupFor('1121', 'ASSET')).toBe('Bank Accounts');
  });

  it('keeps GST on both sides under Duties & Taxes', () => {
    expect(tallyGroupFor('1151', 'ASSET')).toBe('Duties & Taxes');   // input credit
    expect(tallyGroupFor('2141', 'LIABILITY')).toBe('Duties & Taxes'); // output
  });

  it('separates debtors from creditors', () => {
    expect(tallyGroupFor('1130', 'ASSET')).toBe('Sundry Debtors');
    expect(tallyGroupFor('2110', 'LIABILITY')).toBe('Sundry Creditors');
  });

  it('keeps direct project cost above the gross-profit line', () => {
    // 5xxx is construction cost. Under Indirect Expenses it lands below gross
    // profit and every margin Tally reports is wrong.
    expect(tallyGroupFor('5310', 'EXPENSE')).toBe('Direct Expenses');
    expect(tallyGroupFor('5410', 'EXPENSE')).toBe('Direct Expenses');
    expect(tallyGroupFor('6900', 'EXPENSE')).toBe('Indirect Expenses');
  });

  it('falls back on the account type when the code has no convention', () => {
    expect(tallyGroupFor('4100', 'INCOME')).toBe('Sales Accounts');
    expect(tallyGroupFor('6900', 'EXPENSE')).toBe('Indirect Expenses');
    expect(tallyGroupFor('3000', 'EQUITY')).toBe('Capital Account');
  });
});

describe('CRM source → Tally voucher type', () => {
  it('maps invoices and bills to Sales and Purchase', () => {
    expect(tallyTypeFor('Invoice', false, false)).toBe('Sales');
    expect(tallyTypeFor('VendorBill', false, false)).toBe('Purchase');
  });

  it('tells a receipt from a payment by which side the money is on', () => {
    expect(tallyTypeFor('Voucher', true, true)).toBe('Receipt');
    expect(tallyTypeFor('Voucher', true, false)).toBe('Payment');
  });

  it('calls anything with no money account a Journal', () => {
    expect(tallyTypeFor('Manual', false, false)).toBe('Journal');
  });
});
