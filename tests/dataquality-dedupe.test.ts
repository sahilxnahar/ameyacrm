import { describe, it, expect } from 'vitest';
import { findDuplicates, nameSimilarity, type DedupeRecord } from '@/lib/dataquality/dedupe';

const rec = (id: string, name: string, phone?: string, email?: string): DedupeRecord => ({ id, name, phone, email });

describe('nameSimilarity', () => {
  it('treats honorifics and punctuation as noise', () => {
    expect(nameSimilarity('M/s. Sri Ram Traders', 'sri ram traders')).toBe(1);
  });
  it('is 1 for identical and low for unrelated', () => {
    expect(nameSimilarity('Ashok Cement', 'Ashok Cement')).toBe(1);
    expect(nameSimilarity('Ashok Cement', 'Zenith Steel')).toBeLessThan(0.5);
  });
});

describe('findDuplicates', () => {
  it('matches HIGH on a shared phone regardless of spelling', () => {
    const dups = findDuplicates([
      rec('a', 'Ashok Cement', '9876543210'),
      rec('b', 'Ashok Cements', '+91 98765 43210'),
    ]);
    expect(dups).toHaveLength(1);
    expect(dups[0]!.confidence).toBe('HIGH');
    expect(dups[0]!.reason).toContain('phone');
  });

  it('matches HIGH on a shared email', () => {
    const dups = findDuplicates([
      rec('a', 'Ram Traders', undefined, 'ram@x.com'),
      rec('b', 'R Traders', undefined, 'RAM@x.com'),
    ]);
    expect(dups[0]!.confidence).toBe('HIGH');
    expect(dups[0]!.reason).toContain('email');
  });

  it('matches MEDIUM on a near-identical name when phones do not conflict', () => {
    const dups = findDuplicates([rec('a', 'Sri Ram Traders'), rec('b', 'Sri Ram Trader')]);
    expect(dups).toHaveLength(1);
    expect(dups[0]!.confidence).toBe('MEDIUM');
  });

  it('does not flag a name match when the two phones actively disagree', () => {
    const dups = findDuplicates([
      rec('a', 'Sri Ram Traders', '9876543210'),
      rec('b', 'Sri Ram Trader', '9000000000'),
    ]);
    expect(dups).toHaveLength(0);
  });

  it('does not match two entirely different vendors', () => {
    const dups = findDuplicates([rec('a', 'Ashok Cement', '111'), rec('b', 'Zenith Steel', '222')]);
    expect(dups).toHaveLength(0);
  });

  it('orders HIGH-confidence pairs before MEDIUM', () => {
    const dups = findDuplicates([
      rec('a', 'Alpha Traders', '9876543210'),
      rec('b', 'Alpha Traders', '9876543210'), // HIGH (same phone)
      rec('c', 'Beta Supplies'),
      rec('d', 'Beta Supply'), // MEDIUM (name)
    ]);
    expect(dups[0]!.confidence).toBe('HIGH');
  });
});
