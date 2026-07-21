import { describe, it, expect } from 'vitest';
import { entityHref, isLinkable, entityTypeLabel } from '@/lib/links/entities';

describe('entity links (I4)', () => {
  it('routes records with a detail page to that page', () => {
    expect(entityHref('Lead', 'abc')).toBe('/sales/abc');
    expect(entityHref('Task', 't1')).toBe('/tasks/t1');
    expect(entityHref('WorkRequest', 'w1')).toBe('/work-requests/w1');
  });

  it('routes list-only types to their list', () => {
    expect(entityHref('Voucher', 'v1')).toBe('/payments');
    expect(entityHref('Unit', 'u1')).toBe('/inventory');
  });

  it('returns null for an unknown type', () => {
    expect(entityHref('Nope', 'x')).toBeNull();
  });

  it('knows which types are linkable', () => {
    expect(isLinkable('Lead')).toBe(true);
    expect(isLinkable('Nope')).toBe(false);
  });

  it('humanises type labels', () => {
    expect(entityTypeLabel('WorkRequest')).toBe('Work request');
    expect(entityTypeLabel('Lead')).toBe('Lead');
  });
});
