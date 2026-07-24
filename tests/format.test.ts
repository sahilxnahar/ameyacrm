import { describe, it, expect } from 'vitest';
import { initials, titleCase, formatCurrency } from '@/lib/utils/format';

describe('formatters', () => {
  it('derives initials', () => { expect(initials('Sahil Nahar')).toBe('SN'); });
  it('title-cases enum values', () => { expect(titleCase('IN_PROGRESS')).toBe('In Progress'); });
  it('formats INR currency', () => { expect(formatCurrency(1500000)).toContain('15,00,000'); });
});
