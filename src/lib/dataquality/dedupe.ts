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

/**
 * Compare every pair once. A shared phone or email is a HIGH-confidence match;
 * a very close name (≥ 0.88 similarity) with no phone that positively
 * contradicts it is MEDIUM. Output is capped and ordered strongest-first.
 */
export function findDuplicates(records: DedupeRecord[], nameThreshold = 0.88, limit = 200): DuplicatePair[] {
  const pairs: DuplicatePair[] = [];
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const a = records[i]!;
      const b = records[j]!;
      const aPhone = normPhone(a.phone), bPhone = normPhone(b.phone);
      const aEmail = normEmail(a.email), bEmail = normEmail(b.email);

      let confidence: Confidence | null = null;
      let reason = '';
      if (aPhone && aPhone === bPhone) { confidence = 'HIGH'; reason = 'same phone number'; }
      else if (aEmail && aEmail === bEmail) { confidence = 'HIGH'; reason = 'same email'; }
      else {
        const sim = nameSimilarity(a.name, b.name);
        // A close name is only a candidate if the phones do not actively disagree.
        const phonesConflict = aPhone && bPhone && aPhone !== bPhone;
        if (sim >= nameThreshold && !phonesConflict) {
          confidence = 'MEDIUM';
          reason = `near-identical name (${Math.round(sim * 100)}%)`;
        }
      }

      if (confidence) {
        pairs.push({ aId: a.id, bId: b.id, aLabel: a.name, bLabel: b.name, reason, confidence });
      }
    }
  }
  pairs.sort((p, q) => (p.confidence === q.confidence ? 0 : p.confidence === 'HIGH' ? -1 : 1));
  return pairs.slice(0, limit);
}
