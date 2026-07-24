import { describe, it, expect } from 'vitest';
import { currentConsent, CONSENT_PURPOSE_KEYS } from '@/lib/privacy/consent';

describe('consent trail', () => {
  it('reduces an append-only trail to the latest state per purpose', () => {
    const trail = [
      { purpose: 'MARKETING', status: 'GIVEN', createdAt: '2026-01-01T00:00:00Z' },
      { purpose: 'MARKETING', status: 'WITHDRAWN', createdAt: '2026-06-01T00:00:00Z' },
      { purpose: 'WHATSAPP', status: 'GIVEN', createdAt: '2026-03-01T00:00:00Z' },
    ];
    const state = currentConsent(trail);
    expect(state.MARKETING!.status).toBe('WITHDRAWN'); // latest wins
    expect(state.WHATSAPP!.status).toBe('GIVEN');
  });

  it('is order-independent', () => {
    const a = currentConsent([
      { purpose: 'CALLS', status: 'WITHDRAWN', createdAt: '2026-06-01T00:00:00Z' },
      { purpose: 'CALLS', status: 'GIVEN', createdAt: '2026-01-01T00:00:00Z' },
    ]);
    expect(a.CALLS!.status).toBe('WITHDRAWN');
  });

  it('exposes the four DPDPA purposes', () => {
    expect(CONSENT_PURPOSE_KEYS).toEqual(['MARKETING', 'WHATSAPP', 'CALLS', 'DATA_PROCESSING']);
  });
});
