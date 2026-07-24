import { describe, it, expect } from 'vitest';
import { rollingForecast, startOfWeek, type Flow } from '@/lib/treasury/forecast';

const NOW = new Date('2026-07-21T09:00:00Z'); // a Tuesday
const d = (s: string) => new Date(s + 'T00:00:00Z');

describe('startOfWeek', () => {
  it('returns the Monday on or before the date', () => {
    expect(startOfWeek(NOW).toISOString().slice(0, 10)).toBe('2026-07-20'); // Monday
    expect(startOfWeek(d('2026-07-20')).toISOString().slice(0, 10)).toBe('2026-07-20');
    expect(startOfWeek(d('2026-07-26')).toISOString().slice(0, 10)).toBe('2026-07-20'); // Sunday -> same week Monday
  });
});

describe('rollingForecast', () => {
  it('produces the requested number of weekly buckets', () => {
    const f = rollingForecast(NOW, 100000, [], 12);
    expect(f.buckets).toHaveLength(12);
    expect(f.opening).toBe(100000);
    expect(f.closing).toBe(100000);
  });

  it('places inflows and outflows in the right week and runs the balance', () => {
    const flows: Flow[] = [
      { date: d('2026-07-22'), amount: 200000 }, // week 0
      { date: d('2026-07-29'), amount: -50000 }, // week 1
    ];
    const f = rollingForecast(NOW, 100000, flows, 12);
    expect(f.buckets[0]!.inflow).toBe(200000);
    expect(f.buckets[0]!.closing).toBe(300000);
    expect(f.buckets[1]!.outflow).toBe(50000);
    expect(f.buckets[1]!.closing).toBe(250000);
    expect(f.closing).toBe(250000);
  });

  it('folds an overdue flow into the current week rather than dropping it', () => {
    const f = rollingForecast(NOW, 0, [{ date: d('2026-06-01'), amount: -30000 }], 12);
    expect(f.buckets[0]!.outflow).toBe(30000);
    expect(f.buckets[0]!.closing).toBe(-30000);
  });

  it('ignores flows beyond the horizon', () => {
    const f = rollingForecast(NOW, 0, [{ date: d('2027-01-01'), amount: 999999 }], 12);
    expect(f.closing).toBe(0);
  });

  it('reports the lowest point and the week it occurs', () => {
    const flows: Flow[] = [
      { date: d('2026-07-22'), amount: -80000 }, // week 0 -> -80000
      { date: d('2026-07-29'), amount: 200000 }, // week 1 -> +120000
    ];
    const f = rollingForecast(NOW, 0, flows, 12);
    expect(f.lowestPoint).toBe(-80000);
    expect(f.lowestWeekIndex).toBe(0);
  });
});
