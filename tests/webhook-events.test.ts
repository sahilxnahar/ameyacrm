import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_KEYS, TRIGGER_TO_EVENT } from '@/lib/webhooks/events';

describe('webhook events', () => {
  it('has unique, well-formed event keys', () => {
    const keys = WEBHOOK_EVENTS.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^[a-z]+\.[a-z_]+$/);
  });

  it('maps every automation trigger to a real event', () => {
    for (const evt of Object.values(TRIGGER_TO_EVENT)) {
      expect(WEBHOOK_EVENT_KEYS).toContain(evt);
    }
  });

  it('produces a stable HMAC signature for a body', () => {
    const body = JSON.stringify({ event: 'lead.created', data: { id: '1' } });
    const secret = 'whsec_test';
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    // deterministic: same input → same signature
    expect(createHmac('sha256', secret).update(body).digest('hex')).toBe(sig);
    expect(sig).toMatch(/^[a-f0-9]{64}$/);
  });
});
