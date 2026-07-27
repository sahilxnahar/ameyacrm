import { describe, it, expect } from 'vitest';
import {
  buildBriefingSignalsPrompt,
  parseBriefingJson,
  fallbackBriefing,
  type BriefAlert,
} from '@/lib/attention/briefing';

describe('buildBriefingSignalsPrompt', () => {
  it('embeds the signals and demands strict JSON with no invented numbers', () => {
    const prompt = buildBriefingSignalsPrompt('- Overdue payments: 3 milestones, Rs.12,00,000');
    expect(prompt).toContain('Rs.12,00,000');
    expect(prompt).toMatch(/JSON object/i);
    expect(prompt).toMatch(/do not invent/i);
  });
});

describe('parseBriefingJson', () => {
  it('parses a plain JSON object', () => {
    const r = parseBriefingJson('{"headline":"All good","bullets":["a","b"],"actions":["Call X"]}');
    expect(r).not.toBeNull();
    expect(r!.headline).toBe('All good');
    expect(r!.bullets).toEqual(['a', 'b']);
    expect(r!.actions).toEqual(['Call X']);
  });

  it('tolerates a ```json code fence and surrounding prose', () => {
    const raw = 'Here you go:\n```json\n{"headline":"H","bullets":["x"],"actions":[]}\n```\nHope that helps.';
    const r = parseBriefingJson(raw);
    expect(r).not.toBeNull();
    expect(r!.headline).toBe('H');
    expect(r!.bullets).toEqual(['x']);
  });

  it('returns null when there is no usable headline', () => {
    expect(parseBriefingJson('not json at all')).toBeNull();
    expect(parseBriefingJson('{"bullets":["x"]}')).toBeNull();
  });

  it('coerces and caps array items', () => {
    const many = JSON.stringify({ headline: 'H', bullets: Array(20).fill('b'), actions: [1, 2, 3] });
    const r = parseBriefingJson(many);
    expect(r!.bullets.length).toBeLessThanOrEqual(6);
    expect(r!.actions).toEqual(['1', '2', '3']);
  });
});

describe('fallbackBriefing', () => {
  const alerts: BriefAlert[] = [
    { severity: 'high', title: '2 overdue payment(s)', detail: 'Rs.15,00,000 past due.' },
    { severity: 'medium', title: '3 stalled lead(s)', detail: 'No activity in 14+ days.' },
    { severity: 'low', title: '1 partner awaiting KYC', detail: 'Cannot be paid brokerage.' },
  ];

  it('leads with the high-priority count', () => {
    const b = fallbackBriefing(alerts);
    expect(b.headline).toMatch(/1 high-priority issue/i);
  });

  it('turns alerts into bullets and verb-first actions, most severe first', () => {
    const b = fallbackBriefing(alerts);
    expect(b.bullets[0]).toContain('overdue payment');
    expect(b.actions[0]).toBe('Handle: 2 overdue payment(s)');
    expect(b.actions.length).toBeLessThanOrEqual(3);
  });

  it('is reassuring and never empty when there are no alerts', () => {
    const b = fallbackBriefing([]);
    expect(b.headline).toMatch(/clean board/i);
    expect(Array.isArray(b.bullets)).toBe(true);
    expect(Array.isArray(b.actions)).toBe(true);
  });
});
