import { describe, it, expect } from 'vitest';
import { isValidUanFormat, normaliseUan, parseUanBlock } from '@/lib/labour/uan';

describe('UAN validation (module #68)', () => {
  it('accepts a clean 12-digit UAN and strips spaces/hyphens', () => {
    expect(isValidUanFormat('123456789012')).toBe(true);
    expect(isValidUanFormat('1234 5678 9012')).toBe(true);
    expect(isValidUanFormat('1234-5678-9012')).toBe(true);
    expect(normaliseUan('1234 5678 9012')).toBe('123456789012');
  });
  it('rejects wrong-length or non-numeric UANs', () => {
    expect(isValidUanFormat('12345')).toBe(false);
    expect(isValidUanFormat('12345678901')).toBe(false);   // 11 digits
    expect(isValidUanFormat('1234567890123')).toBe(false); // 13 digits
    expect(isValidUanFormat('12345678901A')).toBe(false);
    expect(isValidUanFormat('')).toBe(false);
  });
  it('parses a pasted block with names and flags format validity', () => {
    const rows = parseUanBlock('Ramesh, 123456789012\nSuresh 100200300400\nBadRow, 999');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ workerName: 'Ramesh', uan: '123456789012', validFormat: true });
    expect(rows[1]).toMatchObject({ workerName: 'Suresh', uan: '100200300400', validFormat: true });
    expect(rows[2]!.validFormat).toBe(false);
  });
  it('ignores blank lines', () => {
    expect(parseUanBlock('\n\n  \n123456789012\n')).toHaveLength(1);
  });
});
