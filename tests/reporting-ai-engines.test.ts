import { describe, it, expect } from 'vitest';
import { aggregate } from '@/lib/reports/aggregate';
import { detectAnomalies } from '@/lib/ai/anomaly';

describe('aggregate (report builder engine)', () => {
  const rows = [
    { status: 'WON', amount: 100 },
    { status: 'WON', amount: 300 },
    { status: 'LOST', amount: 50 },
    { status: 'OPEN', amount: 0 },
    { status: '', amount: 10 },
  ];

  it('counts rows per group and sorts by value desc', () => {
    const r = aggregate(rows, 'status', 'count');
    expect(r.metric).toBe('count');
    expect(r.rows[0]).toMatchObject({ key: 'WON', count: 2, value: 2 });
    // total is the sum of the per-group metric values
    expect(r.total).toBe(5);
  });

  it('sums a value field per group', () => {
    const r = aggregate(rows, 'status', 'sum', 'amount');
    const won = r.rows.find((x) => x.key === 'WON');
    expect(won?.sum).toBe(400);
    expect(won?.value).toBe(400);
  });

  it('averages a value field per group', () => {
    const r = aggregate(rows, 'status', 'avg', 'amount');
    const won = r.rows.find((x) => x.key === 'WON');
    expect(won?.avg).toBe(200);
  });

  it('buckets null / empty group keys under a dash', () => {
    const r = aggregate(rows, 'status', 'count');
    expect(r.rows.some((x) => x.key === '—')).toBe(true);
  });

  it('ignores non-numeric values in a sum instead of producing NaN', () => {
    const dirty = [{ g: 'a', v: 'not-a-number' }, { g: 'a', v: 5 }];
    const r = aggregate(dirty, 'g', 'sum', 'v');
    expect(r.rows[0]?.sum).toBe(5);
  });

  it('returns an empty result for no rows', () => {
    const r = aggregate([], 'status', 'count');
    expect(r.rows).toEqual([]);
    expect(r.total).toBe(0);
  });

  it('is stable: equal values break ties by key name', () => {
    const r = aggregate([{ g: 'b' }, { g: 'a' }], 'g', 'count');
    expect(r.rows.map((x) => x.key)).toEqual(['a', 'b']);
  });
});

describe('detectAnomalies (cost-anomaly engine)', () => {
  it('flags a value more than the threshold above the mean', () => {
    const obs = [
      { id: '1', label: 'Bill A', value: 100 },
      { id: '2', label: 'Bill B', value: 100 },
      { id: '3', label: 'Bill C', value: 100 },
      { id: '4', label: 'Bill D', value: 200 },
    ];
    const r = detectAnomalies(obs, 40);
    expect(r.anomalies).toHaveLength(1);
    expect(r.anomalies[0]?.id).toBe('4');
    expect(r.anomalies[0]?.deviationPct).toBeGreaterThan(40);
  });

  it('does not flag low outliers — paying less is not a problem', () => {
    const obs = [
      { id: '1', label: 'A', value: 100 },
      { id: '2', label: 'B', value: 100 },
      { id: '3', label: 'C', value: 100 },
      { id: '4', label: 'D', value: 10 },
    ];
    const r = detectAnomalies(obs, 40);
    expect(r.anomalies).toHaveLength(0);
  });

  it('says nothing below the minimum sample size', () => {
    const obs = [
      { id: '1', label: 'A', value: 100 },
      { id: '2', label: 'B', value: 1000 },
    ];
    const r = detectAnomalies(obs, 40, 3);
    expect(r.anomalies).toEqual([]);
    expect(r.mean).toBe(0);
  });

  it('sorts multiple anomalies by how far out they are', () => {
    // Eight baseline points at 100 keep the mean (155) low enough that both
    // 250 and 500 clear the 40% cutoff (217), so we get two anomalies to sort.
    const obs = [
      { id: '1', label: 'A', value: 100 },
      { id: '2', label: 'B', value: 100 },
      { id: '3', label: 'C', value: 100 },
      { id: '4', label: 'D', value: 100 },
      { id: '5', label: 'E', value: 100 },
      { id: '6', label: 'F', value: 100 },
      { id: '7', label: 'G', value: 100 },
      { id: '8', label: 'H', value: 100 },
      { id: '9', label: 'I', value: 250 },
      { id: '10', label: 'J', value: 500 },
    ];
    const r = detectAnomalies(obs, 40);
    expect(r.anomalies[0]?.id).toBe('10');
    expect(r.anomalies[1]?.id).toBe('9');
  });

  it('ignores zero and negative values when forming the benchmark', () => {
    const obs = [
      { id: '1', label: 'A', value: 100 },
      { id: '2', label: 'B', value: 100 },
      { id: '3', label: 'C', value: 100 },
      { id: '4', label: 'Z', value: 0 },
    ];
    const r = detectAnomalies(obs, 40);
    expect(r.mean).toBe(100);
  });
});
