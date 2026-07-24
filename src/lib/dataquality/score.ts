/**
 * Data-quality scoring, kept pure so it can be tested without a database.
 *
 * The point is not to grade for its own sake but to produce a worklist: the
 * records that are missing the fields the rest of the system needs, worst
 * first, so somebody can fix the twenty that matter rather than despair at the
 * thousand that do not. Completeness is measured against the fields each entity
 * actually depends on; consistency is a handful of format checks that catch the
 * errors which silently break a printed invoice or a bank transfer.
 */

export type Grade = 'A' | 'B' | 'C' | 'D';

export interface ConsistencyCheck {
  field: string;
  message: string;
  /** Return true when the value is *wrong*. Only runs when the value is present. */
  isWrong: (value: string) => boolean;
}

export interface QualityResult {
  id: string;
  label: string;
  /** 0–100. Completeness, less a fixed penalty for each consistency issue. */
  score: number;
  grade: Grade;
  missing: string[];
  issues: string[];
}

const isEmpty = (v: unknown): boolean =>
  v == null || (typeof v === 'string' && v.trim() === '');

function grade(score: number): Grade {
  if (score >= 90) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}

/**
 * Score one record. `required` are the fields the entity needs to be useful;
 * each missing one costs an equal share of 100. Every consistency issue then
 * takes a flat 15 off, floored at zero, because a malformed IFSC is worse than
 * a blank one — it looks filled in.
 */
export function scoreRecord(
  id: string,
  label: string,
  values: Record<string, unknown>,
  required: string[],
  checks: ConsistencyCheck[] = [],
): QualityResult {
  // Which present fields are malformed. A field that is filled in but wrong is
  // recorded here so it can be treated as *not satisfied* for completeness — a
  // malformed IFSC looks filled in and is worse than a blank one, so it must not
  // earn the completeness that a blank field is denied.
  const badFields = new Set<string>();
  const issues: string[] = [];
  for (const c of checks) {
    const v = values[c.field];
    if (!isEmpty(v) && c.isWrong(String(v))) {
      issues.push(c.message);
      badFields.add(c.field);
    }
  }

  const missing = required.filter((k) => isEmpty(values[k]));
  const satisfied = required.filter((k) => !isEmpty(values[k]) && !badFields.has(k));
  const completeness = required.length === 0 ? 100 : Math.round((satisfied.length / required.length) * 100);

  const score = Math.max(0, completeness - issues.length * 15);
  return { id, label, score, grade: grade(score), missing, issues };
}

export interface QualitySummary {
  count: number;
  averageScore: number;
  grades: Record<Grade, number>;
  /** The lowest-scoring records, worst first — the actual worklist. */
  worst: QualityResult[];
}

export function summariseQuality(results: QualityResult[], worstN = 20): QualitySummary {
  const grades: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0 };
  let total = 0;
  for (const r of results) { grades[r.grade]++; total += r.score; }
  const worst = [...results]
    .filter((r) => r.score < 100)
    .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label))
    .slice(0, worstN);
  return {
    count: results.length,
    averageScore: results.length ? Math.round(total / results.length) : 100,
    grades,
    worst,
  };
}

// ── Reusable Indian-format consistency checks ────────────────────────────────

/** Every Indian IFSC is exactly 11 characters: 4 letters, a 0, then 6 alphanumerics. */
export const ifscCheck: ConsistencyCheck = {
  field: 'bankIfsc',
  message: 'IFSC is not 11 characters in the standard format',
  isWrong: (v) => !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.trim().toUpperCase()),
};

/** A GSTIN is 15 characters. This is a shape check, not a checksum. */
export const gstinCheck: ConsistencyCheck = {
  field: 'gstin',
  message: 'GSTIN is not in the 15-character format',
  isWrong: (v) => !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/.test(v.trim().toUpperCase()),
};

/** A PAN is five letters, four digits, a letter. */
export const panCheck: ConsistencyCheck = {
  field: 'pan',
  message: 'PAN is not in the AAAAA9999A format',
  isWrong: (v) => !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v.trim().toUpperCase()),
};

/** A usable Indian mobile has ten digits once the country code and punctuation
 *  are stripped, starting 6–9. */
export const phoneCheck: ConsistencyCheck = {
  field: 'phone',
  message: 'Phone does not resolve to a 10-digit Indian mobile',
  isWrong: (v) => {
    const digits = v.replace(/\D/g, '').replace(/^91/, '');
    return !/^[6-9][0-9]{9}$/.test(digits);
  },
};

export const emailCheck: ConsistencyCheck = {
  field: 'email',
  message: 'Email does not look valid',
  isWrong: (v) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
};
