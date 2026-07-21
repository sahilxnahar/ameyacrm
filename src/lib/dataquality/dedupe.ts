/**
 * Duplicate detection, kept pure and deliberately read-only.
 *
 * This finds *likely* duplicates and surfaces them for a person to judge. It
 * does not merge anything — a destructive merge reassigns foreign keys across
 * half a dozen tables and is its own careful piece of work. Detection is the
 * safe, useful half: "these two vendors are probably the same" is worth knowing
 * even when the merge is done by hand.
 *
 * "One vendor, not four spellings of it" is the goal. Matching is on the
 * identity a human would use — the phone, the email, and the name once case,
 * spacing and honorifics are stripped.
 */

export interface DedupeRecord {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
}

export type Confidence = 'HIGH' | 'MEDIUM';

export interface DuplicatePair {
  aId: string;
  bId: string;
  aLabel: string;
  bLabel: string;
  reason: string;
  confidence: Confidence;
}

/** Last ten digits, so "+91 98765 43210" and "098765 43210" compare equal. */
function normPhone(p: string | null | undefined): string {
  if (!p) return '';
  const d = p.replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : '';
}

function normEmail(e: string | null | undefined): string {
  return (e ?? '').trim().toLowerCase();
}

/** Lowercase, drop common honorifics and suffixes, strip punctuation, collapse
 *  spaces — so "M/s. Sri Ram Traders" and "sri ram traders" compare equal. */
function normName(n: string): string {
  return n
    .toLowerCase()
    .replace(/\b(m\/s|mr|mrs|ms|shri|sri|smt|the|pvt|private|ltd|limited|llp|and|co)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Levenshtein distance, iterative and allocation-light. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    prev = curr;
  }
  return prev[b.length]!;
}

/** 1 = identical, 0 = nothing in common. */
export function nameSimilarity(a: string, b: string): number {
  const x = normName(a);
  const y = normName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const dist = levenshtein(x, y);
  return 1 - dist / Math.max(x.length, y.length);
}

/** Name comparison is O(n²); above this many records it is skipped rather than
 *  hang the request. The HIGH-confidence phone/email matches, which are what
 *  matter most, are found by bucketing in O(n) and always run. */
const NAME_PASS_CAP = 1500;

/**
 * Find likely-duplicate records, fast enough to run inside a page render.
 *
 * Each record is normalised once. Exact phone and email matches are found by
 * bucketing — O(n), not O(n²) — because those are certain and cheap. The
 * fuzzy-name pass is the only quadratic step, so it runs only on reasonably
 * sized sets and never re-normalises inside the loop. A shared phone or email is
 * HIGH confidence; a very close name (≥ threshold) with no phone that positively
 * contradicts it is MEDIUM. Output is capped and ordered strongest-first.
 */
export function findDuplicates(records: DedupeRecord[], nameThreshold = 0.88, limit = 200): DuplicatePair[] {
  const norm = records.map((r) => ({ r, phone: normPhone(r.phone), email: normEmail(r.email), name: normName(r.name) }));
  const pairs: DuplicatePair[] = [];
  const seen = new Set<string>();
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const add = (a: DedupeRecord, b: DedupeRecord, reason: string, confidence: Confidence) => {
    const k = key(a.id, b.id);
    if (seen.has(k)) return;
    seen.add(k);
    pairs.push({ aId: a.id, bId: b.id, aLabel: a.name, bLabel: b.name, reason, confidence });
  };

  // HIGH: bucket by exact phone, then exact email. O(n).
  const bucketBy = (field: 'phone' | 'email', reason: string) => {
    const map = new Map<string, typeof norm>();
    for (const n of norm) {
      const v = n[field];
      if (!v) continue;
      const g = map.get(v);
      if (g) g.push(n); else map.set(v, [n]);
    }
    for (const group of map.values()) {
      if (group.length < 2) continue;
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) add(group[i]!.r, group[j]!.r, reason, 'HIGH');
      }
    }
  };
  bucketBy('phone', 'same phone number');
  bucketBy('email', 'same email');

  // MEDIUM: fuzzy name, only when the set is small enough, never re-normalising.
  if (norm.length <= NAME_PASS_CAP) {
    for (let i = 0; i < norm.length; i++) {
      for (let j = i + 1; j < norm.length; j++) {
        const A = norm[i]!, B = norm[j]!;
        if (seen.has(key(A.r.id, B.r.id))) continue;
        if (A.phone && B.phone && A.phone !== B.phone) continue; // phones actively disagree
        if (!A.name || !B.name) continue;
        const sim = A.name === B.name ? 1 : 1 - levenshtein(A.name, B.name) / Math.max(A.name.length, B.name.length);
        if (sim >= nameThreshold) add(A.r, B.r, `near-identical name (${Math.round(sim * 100)}%)`, 'MEDIUM');
      }
    }
  }

  pairs.sort((p, q) => (p.confidence === q.confidence ? 0 : p.confidence === 'HIGH' ? -1 : 1));
  return pairs.slice(0, limit);
}
