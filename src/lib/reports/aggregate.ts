/**
 * Report aggregation, kept pure. Batch 10: the report builder lets a person pick
 * a source, a field to group by and a metric — and this does the grouping and
 * the arithmetic, over rows the service has already fetched from a *whitelisted*
 * source. Nothing here builds a query from user input, so there is no injection
 * surface; the caller decides what is queryable.
 */

export type Metric = 'count' | 'sum' | 'avg';

export interface AggRow {
  key: string;
  count: number;
  sum: number;
  avg: number;
  /** The value for the chosen metric — what the chart and the sort use. */
  value: number;
}

export interface AggResult {
  rows: AggRow[];
  total: number;
  metric: Metric;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function aggregate(
  rows: Array<Record<string, unknown>>,
  groupBy: string,
  metric: Metric,
  valueKey?: string,
): AggResult {
  const buckets = new Map<string, { count: number; sum: number }>();
  for (const row of rows) {
    const raw = row[groupBy];
    const key = raw == null || raw === '' ? '—' : String(raw);
    const b = buckets.get(key) ?? { count: 0, sum: 0 };
    b.count += 1;
    if (valueKey) {
      const v = Number(row[valueKey]);
      if (Number.isFinite(v)) b.sum += v;
    }
    buckets.set(key, b);
  }

  const out: AggRow[] = [...buckets.entries()].map(([key, b]) => {
    const avg = b.count > 0 ? b.sum / b.count : 0;
    const value = metric === 'count' ? b.count : metric === 'sum' ? b.sum : avg;
    return { key, count: b.count, sum: r2(b.sum), avg: r2(avg), value: r2(value) };
  });
  out.sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));

  return { rows: out, total: r2(out.reduce((s, r) => s + r.value, 0)), metric };
}
