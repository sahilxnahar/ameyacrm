import { describe, it, expect } from 'vitest';
import { normalizeLeadPayload, LEAD_CONNECTOR_SLUGS } from '@/lib/connectors/lead-normalize';

describe('portal lead ingestion (v15.29)', () => {
  it('maps a 99acres-style payload', () => {
    const n = normalizeLeadPayload({ Name: 'Rahul Jain', Mobile: '9800000000', Email: 'R@X.com', Project: 'Ameya Four94', Message: 'Wants 3BHK' });
    expect(n.name).toBe('Rahul Jain');
    expect(n.phone).toBe('9800000000');
    expect(n.email).toBe('r@x.com');
    expect(n.projectCode).toBe('Ameya Four94');
    expect(n.requirement).toBe('Wants 3BHK');
  });

  it('maps a MagicBricks-style payload with different keys', () => {
    const n = normalizeLeadPayload({ full_name: 'Sita', phone_number: '9111111111', query: '2BHK budget 80L', budget: '8000000' });
    expect(n.name).toBe('Sita');
    expect(n.phone).toBe('9111111111');
    expect(n.requirement).toBe('2BHK budget 80L');
    expect(n.budget).toBe(8000000);
  });

  it('strips currency formatting from budget', () => {
    expect(normalizeLeadPayload({ name: 'A', phone: '9', budget: '₹1,20,00,000' }).budget).toBe(12000000);
  });

  it('returns empty name when nothing matches (endpoint rejects it)', () => {
    const n = normalizeLeadPayload({ foo: 'bar' });
    expect(n.name).toBe('');
    expect(n.phone).toBeNull();
  });

  it('lists the portal connectors', () => {
    expect(LEAD_CONNECTOR_SLUGS).toContain('99acres');
    expect(LEAD_CONNECTOR_SLUGS).toContain('magicbricks');
  });
});
