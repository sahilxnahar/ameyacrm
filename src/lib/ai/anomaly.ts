/**
 * Cost-anomaly detection, kept pure and statistical (no live model needed, so it
 * is testable and cannot fail on a missing key). Batch 9: "this bill is 40% above
 * the running rate for the same item, and nobody noticed." Given a set of
 * observations that should be comparable — the rate paid for one material across
 * many bills — it flags the ones that stand out, with how far out they are.
 */

export interface Observation {
  id: string;
  label: string;
  value: number;
}

export interface Anomaly {
  id: string;
  label: string;
  value: number;
  mean: number;
  /** value ÷ mean. */
  ratio: number;
  /** How far above the mean, as a percentage. */
  deviationPct: number;
}

export interface AnomalyResult {
  mean: number;
  count: number;
  anomalies: Anomaly[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Flag observations more than `thresholdPct` above the mean. Needs at least
 * `minSample` points to say anything — an average of two is not a benchmark.
 * Only high outliers are returned: paying *less* than usual is not a problem to
 * chase.
 */
export function detectAnomalies(observations: Observation[], thresholdPct = 40, minSample = 3): AnomalyResult {
  const values = observations.map((o) => o.value).filter((v) => Number.isFinite(v) && v > 0);
  if (values.length < minSample) return { mean: 0, count: observations.length, anomalies: [] };

  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const cutoff = mean * (1 + thresholdPct / 100);

  const anomalies: Anomaly[] = observations
    .filter((o) => Number.isFinite(o.value) && o.value > cutoff)
    .map((o) => ({
      id: o.id,
      label: o.label,
      value: r2(o.value),
      mean: r2(mean),
      ratio: r2(o.value / mean),
      deviationPct: r2((o.value / mean - 1) * 100),
    }))
    .sort((a, b) => b.deviationPct - a.deviationPct);

  return { mean: r2(mean), count: observations.length, anomalies };
}
