import { describe, it, expect } from 'vitest';
import { CONNECTORS, CONNECTOR_CATEGORIES, connectorBySlug, CONNECTOR_COUNT, LIVE_CONNECTOR_COUNT } from '@/config/connectors';

describe('App Exchange connector directory (v15.25)', () => {
  it('has a substantial, unique-slug directory', () => {
    expect(CONNECTOR_COUNT).toBeGreaterThan(100);
    const slugs = CONNECTORS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length); // no duplicate slugs
  });

  it('every connector has a known category and valid tier/auth', () => {
    const tiers = new Set(['live', 'beta', 'available']);
    const auths = new Set(['oauth2', 'apikey', 'webhook', 'native', 'none']);
    for (const c of CONNECTORS) {
      expect(CONNECTOR_CATEGORIES).toContain(c.category);
      expect(tiers.has(c.tier)).toBe(true);
      expect(auths.has(c.auth)).toBe(true);
      expect(c.slug).toMatch(/^[a-z0-9-]+$/);
      expect(c.name.length).toBeGreaterThan(0);
    }
  });

  it('resolves connectors by slug', () => {
    expect(connectorBySlug('slack')?.name).toBe('Slack');
    expect(connectorBySlug('razorpay')?.category).toBe('Payments & Finance');
    expect(connectorBySlug('does-not-exist')).toBeUndefined();
  });

  it('reports a live subset that actually works today', () => {
    expect(LIVE_CONNECTOR_COUNT).toBeGreaterThan(5);
    expect(LIVE_CONNECTOR_COUNT).toBeLessThan(CONNECTOR_COUNT);
  });
});
