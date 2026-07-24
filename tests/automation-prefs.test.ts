import { describe, it, expect } from 'vitest';
import { readMyAutomationPrefs } from '@/lib/automation/my-prefs';

describe('personal automation prefs (v15.17)', () => {
  it('keeps only well-formed prefs', () => {
    const prefs = readMyAutomationPrefs({
      sales_stale_lead_nudge: { on: true, dueInDays: 2, priority: 'HIGH' },
      collections_daily_due: { on: false },
      junk: 'not an object',
      bad_priority: { on: true, priority: 'WHENEVER' },
      out_of_range: { on: true, dueInDays: 9999 },
    });
    expect(prefs.sales_stale_lead_nudge).toEqual({ on: true, dueInDays: 2, priority: 'HIGH' });
    expect(prefs.collections_daily_due).toEqual({ on: false });
    expect(prefs.junk).toBeUndefined();
    expect(prefs.bad_priority?.priority).toBeUndefined(); // invalid priority dropped
    expect(prefs.out_of_range?.dueInDays).toBeUndefined(); // out-of-range dropped
  });

  it('returns an empty object for junk input', () => {
    expect(readMyAutomationPrefs(null)).toEqual({});
    expect(readMyAutomationPrefs('nope')).toEqual({});
    expect(readMyAutomationPrefs(42)).toEqual({});
  });

  it('treats a missing "on" as off', () => {
    const prefs = readMyAutomationPrefs({ a: { dueInDays: 1 } });
    expect(prefs.a?.on).toBe(false);
  });
});
