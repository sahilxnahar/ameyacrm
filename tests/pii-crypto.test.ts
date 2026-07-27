import { describe, it, expect } from 'vitest';
import { encryptWriteArgs, decryptResult } from '@/lib/security/pii-crypto';
import { looksEncrypted } from '@/lib/utils/crypto';

describe('pii-crypto', () => {
  it('encrypts a protected field on create and decrypts it back on read', () => {
    const args: Record<string, unknown> = { data: { name: 'Acme', pan: 'ABCDE1234F', bankAccountNumber: '123456789012' } };
    encryptWriteArgs(args);
    const data = args.data as { name: string; pan: string; bankAccountNumber: string };
    expect(data.pan).not.toBe('ABCDE1234F');
    expect(looksEncrypted(data.pan)).toBe(true);
    expect(looksEncrypted(data.bankAccountNumber)).toBe(true);
    // Non-protected field untouched.
    expect(data.name).toBe('Acme');

    const row = { name: 'Acme', pan: data.pan, bankAccountNumber: data.bankAccountNumber };
    decryptResult(row);
    expect(row.pan).toBe('ABCDE1234F');
    expect(row.bankAccountNumber).toBe('123456789012');
  });

  it('handles the update { set } wrapper', () => {
    const args: Record<string, unknown> = { data: { pan: { set: 'PQRSX9999Z' } } };
    encryptWriteArgs(args);
    const set = (args.data as { pan: { set: string } }).pan.set;
    expect(looksEncrypted(set)).toBe(true);
    expect(decryptResult({ pan: set })).toEqual({ pan: 'PQRSX9999Z' });
  });

  it('decrypts protected fields inside a nested include', () => {
    const args: Record<string, unknown> = { data: { pan: 'ABCDE1234F' } };
    encryptWriteArgs(args);
    const enc = (args.data as { pan: string }).pan;
    const bill = { id: 'b1', amount: 500, vendor: { name: 'Acme', pan: enc } };
    decryptResult(bill);
    expect(bill.vendor.pan).toBe('ABCDE1234F');
  });

  it('leaves plain-text (pre-encryption) values unchanged on read', () => {
    const row = { pan: 'LEGACYPLAIN', bankAccountNumber: '99998888' };
    decryptResult(row);
    expect(row.pan).toBe('LEGACYPLAIN');
    expect(row.bankAccountNumber).toBe('99998888');
  });

  it('does not touch a where filter inside a nested write', () => {
    const args: Record<string, unknown> = { data: { items: { update: { where: { pan: 'FILTERVAL' }, data: { pan: 'NEWVALUE12' } } } } };
    encryptWriteArgs(args);
    const nested = (args.data as { items: { update: { where: { pan: string }; data: { pan: string } } } }).items.update;
    expect(nested.where.pan).toBe('FILTERVAL'); // untouched — can't match ciphertext
    expect(looksEncrypted(nested.data.pan)).toBe(true); // the value being written IS encrypted
  });
});
