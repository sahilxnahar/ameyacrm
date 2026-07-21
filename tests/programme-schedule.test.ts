import { describe, it, expect } from 'vitest';
import { computeSchedule, earnedValue, type SchedActivity, type SchedDependency } from '@/lib/programme/schedule';

describe('computeSchedule (critical path)', () => {
  it('schedules a simple chain and marks it all critical', () => {
    const acts: SchedActivity[] = [{ id: 'a', durationDays: 3 }, { id: 'b', durationDays: 2 }];
    const deps: SchedDependency[] = [{ predecessorId: 'a', successorId: 'b' }];
    const r = computeSchedule(acts, deps);
    expect(r.hasCycle).toBe(false);
    expect(r.projectDuration).toBe(5);
    const b = r.activities.find((x) => x.id === 'b')!;
    expect(b.earlyStart).toBe(3);
    expect(b.earlyFinish).toBe(5);
    expect(r.criticalPath.sort()).toEqual(['a', 'b']);
  });

  it('gives float to the shorter of two parallel paths', () => {
    // a -> b -> d (3+4=7) and a -> c -> d (3+1=4). c has float.
    const acts: SchedActivity[] = [
      { id: 'a', durationDays: 3 }, { id: 'b', durationDays: 4 },
      { id: 'c', durationDays: 1 }, { id: 'd', durationDays: 2 },
    ];
    const deps: SchedDependency[] = [
      { predecessorId: 'a', successorId: 'b' },
      { predecessorId: 'a', successorId: 'c' },
      { predecessorId: 'b', successorId: 'd' },
      { predecessorId: 'c', successorId: 'd' },
    ];
    const r = computeSchedule(acts, deps);
    expect(r.projectDuration).toBe(9); // 3 + 4 + 2
    const c = r.activities.find((x) => x.id === 'c')!;
    const b = r.activities.find((x) => x.id === 'b')!;
    expect(b.critical).toBe(true);
    expect(b.totalFloat).toBe(0);
    expect(c.totalFloat).toBe(3); // b takes 4, c takes 1
    expect(c.critical).toBe(false);
    expect(r.criticalPath.sort()).toEqual(['a', 'b', 'd']);
  });

  it('honours a positive lag', () => {
    const r = computeSchedule(
      [{ id: 'a', durationDays: 2 }, { id: 'b', durationDays: 2 }],
      [{ predecessorId: 'a', successorId: 'b', lagDays: 3 }],
    );
    const b = r.activities.find((x) => x.id === 'b')!;
    expect(b.earlyStart).toBe(5); // finish a (2) + lag (3)
    expect(r.projectDuration).toBe(7);
  });

  it('detects a cycle and returns an empty schedule instead of a wrong one', () => {
    const r = computeSchedule(
      [{ id: 'a', durationDays: 1 }, { id: 'b', durationDays: 1 }],
      [{ predecessorId: 'a', successorId: 'b' }, { predecessorId: 'b', successorId: 'a' }],
    );
    expect(r.hasCycle).toBe(true);
    expect(r.activities).toHaveLength(0);
  });
});

describe('earnedValue', () => {
  it('computes EV/PV/AC and the variances', () => {
    const r = earnedValue([
      { plannedCost: 100000, percentComplete: 50, actualCost: 60000, plannedPercent: 100 },
      { plannedCost: 100000, percentComplete: 0, actualCost: 0, plannedPercent: 0 },
    ]);
    expect(r.budgetAtCompletion).toBe(200000);
    expect(r.earnedValue).toBe(50000);      // 50% of first
    expect(r.plannedValue).toBe(100000);    // first fully planned by now
    expect(r.actualCost).toBe(60000);
    expect(r.scheduleVariance).toBe(-50000); // behind: earned 50k vs planned 100k
    expect(r.costVariance).toBe(-10000);     // over: earned 50k vs spent 60k
    expect(r.schedulePerformanceIndex).toBe(0.5);
    expect(r.costPerformanceIndex).toBeCloseTo(0.83, 2);
  });

  it('is safe when nothing is planned or spent yet', () => {
    const r = earnedValue([{ plannedCost: 0, percentComplete: 0, actualCost: 0, plannedPercent: 0 }]);
    expect(r.schedulePerformanceIndex).toBe(0);
    expect(r.costPerformanceIndex).toBe(0);
  });
});
