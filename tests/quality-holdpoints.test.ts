import { describe, it, expect } from 'vitest';
import { holdPointState, canCertify, summariseSafety, permitIsExpired, type InspectionInput, type SafetyInput } from '@/lib/quality/holdpoints';

const insp = (isHoldPoint: boolean, status: 'SCHEDULED' | 'PASSED' | 'FAILED', id = Math.random().toString()): InspectionInput => ({ id, isHoldPoint, status });
const NOW = new Date('2026-07-21T09:00:00Z');
const d = (s: string) => new Date(s + 'T00:00:00Z');

describe('holdPointState', () => {
  it('is not blocked when there are no hold points', () => {
    const s = holdPointState([insp(false, 'SCHEDULED'), insp(false, 'FAILED')]);
    expect(s.blocked).toBe(false);
    expect(s.totalHoldPoints).toBe(0);
  });
  it('is blocked while a hold point is scheduled or failed', () => {
    expect(holdPointState([insp(true, 'SCHEDULED')]).blocked).toBe(true);
    expect(holdPointState([insp(true, 'FAILED')]).blocked).toBe(true);
  });
  it('is not blocked once every hold point has passed', () => {
    const s = holdPointState([insp(true, 'PASSED'), insp(true, 'PASSED'), insp(false, 'SCHEDULED')]);
    expect(s.blocked).toBe(false);
    expect(s.totalHoldPoints).toBe(2);
  });
});

describe('canCertify', () => {
  it('refuses below 100%', () => {
    expect(canCertify(90, []).ok).toBe(false);
  });
  it('refuses at 100% while a hold point is unpassed, with a specific reason', () => {
    const r = canCertify(100, [insp(true, 'SCHEDULED')]);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/hold-point/);
  });
  it('refuses at 100% when a hold point has failed', () => {
    expect(canCertify(100, [insp(true, 'FAILED')]).ok).toBe(false);
  });
  it('allows at 100% with all hold points passed', () => {
    expect(canCertify(100, [insp(true, 'PASSED')]).ok).toBe(true);
  });
});

describe('summariseSafety', () => {
  it('counts by kind and computes days since the last incident', () => {
    const recs: SafetyInput[] = [
      { kind: 'INCIDENT', occurredOn: d('2026-07-11') },
      { kind: 'INCIDENT', occurredOn: d('2026-07-19') },
      { kind: 'NEAR_MISS', occurredOn: d('2026-07-20') },
      { kind: 'TOOLBOX_TALK', occurredOn: d('2026-07-20') },
    ];
    const s = summariseSafety(recs, NOW);
    expect(s.incidents).toBe(2);
    expect(s.nearMisses).toBe(1);
    expect(s.toolboxTalks).toBe(1);
    expect(s.daysSinceLastIncident).toBe(2); // most recent incident 19th, now 21st
  });
  it('reports null days when there has never been an incident', () => {
    expect(summariseSafety([{ kind: 'NEAR_MISS', occurredOn: d('2026-07-20') }], NOW).daysSinceLastIncident).toBeNull();
  });
});

describe('permitIsExpired', () => {
  it('treats an open permit past its window as expired', () => {
    expect(permitIsExpired({ id: 'a', status: 'OPEN', validTo: d('2026-07-01') }, NOW)).toBe(true);
  });
  it('does not expire an open permit still within its window', () => {
    expect(permitIsExpired({ id: 'a', status: 'OPEN', validTo: d('2026-08-01') }, NOW)).toBe(false);
  });
  it('reflects an already-expired status even without a date', () => {
    expect(permitIsExpired({ id: 'a', status: 'EXPIRED', validTo: null }, NOW)).toBe(true);
  });
});
