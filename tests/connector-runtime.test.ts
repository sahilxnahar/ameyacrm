import { describe, it, expect } from 'vitest';
import { formatConnectorMessage } from '@/lib/connectors/format';
import { sealConfig, openConfig, maskConfig } from '@/server/services/connector-runtime';
import { looksEncrypted } from '@/lib/utils/crypto';
import { driverMeta, isConfigurable } from '@/config/connector-drivers';

describe('connector runtime (v15.28)', () => {
  it('formats CRM events into readable notification lines', () => {
    expect(formatConnectorMessage('lead.created', { name: 'Rahul', budgetMax: 12000000, source: 'API' }))
      .toContain('New enquiry: Rahul');
    expect(formatConnectorMessage('lead.stage_changed', { name: 'Rahul', status: 'WON' })).toContain('✅');
    expect(formatConnectorMessage('task.created', { title: 'Call buyer' })).toContain('Call buyer');
  });

  it('encrypts secret fields at rest and decrypts them for use', () => {
    const sealed = sealConfig('slack', { webhookUrl: 'https://hooks.slack.com/services/T/B/x', _events: ['lead.created'] }, null);
    expect(looksEncrypted(String(sealed.webhookUrl))).toBe(true); // secret encrypted
    expect(sealed._events).toEqual(['lead.created']);             // non-secret kept clear
    const open = openConfig(sealed);
    expect(open.webhookUrl).toBe('https://hooks.slack.com/services/T/B/x');
  });

  it('keeps an existing secret when the form sends a blank/mask', () => {
    const first = sealConfig('slack', { webhookUrl: 'https://hooks.slack.com/services/secret' }, null);
    const second = sealConfig('slack', { webhookUrl: '' }, first); // blank = keep
    expect(openConfig(second).webhookUrl).toBe('https://hooks.slack.com/services/secret');
  });

  it('masks secrets when sending config back to the browser', () => {
    const sealed = sealConfig('telegram', { botToken: '123:ABC', chatId: '-100' }, null);
    const masked = maskConfig('telegram', sealed);
    expect(masked.botToken).toBe('••••••••'); // secret masked
    expect(masked.chatId).toBe('-100');        // non-secret visible
  });

  it('exposes configurable drivers', () => {
    expect(isConfigurable('slack')).toBe(true);
    expect(isConfigurable('airtable')).toBe(false); // apikey, no driver → not configurable
    expect(driverMeta('telegram')?.fields.some((f) => f.key === 'botToken')).toBe(true);
  });
});
