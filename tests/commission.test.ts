import { describe, it, expect } from 'vitest';
import { commissionAmount, commissionLabel } from '@/lib/partners/commission';

describe('channel-partner commission (v15.13)', () => {
  it('percent of sale', () => {
    expect(commissionAmount({ basis: 'PERCENT_OF_SALE', pct: 2 }, { saleValue: 10_000_000 })).toBe(200_000);
    expect(commissionLabel({ basis: 'PERCENT_OF_SALE', pct: 2 })).toBe('2%');
  });

  it('months of rent', () => {
    expect(commissionAmount({ basis: 'MONTHS_OF_RENT', months: 1.5 }, { monthlyRent: 40_000 })).toBe(60_000);
    expect(commissionLabel({ basis: 'MONTHS_OF_RENT', months: 1.5 })).toBe('1.5 mo rent + GST');
  });

  it('flat fee', () => {
    expect(commissionAmount({ basis: 'FLAT_FEE', flat: 75_000 }, {})).toBe(75_000);
    expect(commissionLabel({ basis: 'FLAT_FEE', flat: 75_000 }, (n) => `Rs.${n}`)).toBe('Rs.75000 flat');
  });

  it('missing figures produce zero, not NaN', () => {
    expect(commissionAmount({ basis: 'PERCENT_OF_SALE', pct: null }, {})).toBe(0);
    expect(commissionAmount({ basis: 'MONTHS_OF_RENT', months: null }, { monthlyRent: 40_000 })).toBe(0);
  });

  it('labels the un-configured cases gracefully', () => {
    expect(commissionLabel({ basis: 'MONTHS_OF_RENT' })).toBe('Months of rent');
    expect(commissionLabel({ basis: 'FLAT_FEE' })).toBe('Flat fee');
  });
});
