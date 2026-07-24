/**
 * Approval and sanction health, kept pure and timezone-safe.
 *
 * The point of the sanctions register is to turn "which approval is late" from
 * a question somebody has to remember to ask into a number the screen already
 * knows. Every function here takes `now` as an argument rather than reading the
 * clock — the handover records a real bug where a test built its own date in an
 * IST sandbox and disagreed with production. A pure function that is handed the
 * time cannot do that.
 */

export type SanctionStatus =
  | 'NOT_STARTED'
  | 'APPLIED'
  | 'IN_PROCESS'
  | 'QUERY_RAISED'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED';

export interface SanctionInput {
  id: string;
  authority: string;
  name: string;
  status: SanctionStatus;
  expectedOn: Date | null;
  expiresOn: Date | null;
  approvedOn: Date | null;
}

const DAY = 86_400_000;

/** Whole days from `now` to `date`, counted by calendar day at UTC midnight so a
 *  few hours either side of midnight never flip the answer. Negative is past. */
export function daysBetween(now: Date, date: Date): number {
  const a = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const b = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((b - a) / DAY);
}

const OPEN: SanctionStatus[] = ['NOT_STARTED', 'APPLIED', 'IN_PROCESS', 'QUERY_RAISED'];

export function isOpen(status: SanctionStatus): boolean {
  return OPEN.includes(status);
}

export interface SanctionHealth {
  id: string;
  /** Still in the pipeline and its expected date has passed. */
  overdue: boolean;
  daysOverdue: number;
  /** Approved, but the approval itself lapses within the window. */
  expiringSoon: boolean;
  daysToExpiry: number | null;
  /** Already lapsed. */
  expired: boolean;
}

/**
 * Classify one sanction against a reference time.
 *
 * `expiringWithinDays` defaults to 60 — long enough to renew a fire NOC or a
 * consent to operate before it bites, which is the point of warning at all.
 */
export function sanctionHealth(
  s: SanctionInput,
  now: Date,
  expiringWithinDays = 60,
): SanctionHealth {
  const overdue = isOpen(s.status) && s.expectedOn != null && daysBetween(now, s.expectedOn) < 0;
  const daysOverdue = overdue && s.expectedOn ? -daysBetween(now, s.expectedOn) : 0;

  let expiringSoon = false;
  let expired = false;
  let daysToExpiry: number | null = null;
  if (s.expiresOn) {
    daysToExpiry = daysBetween(now, s.expiresOn);
    if (daysToExpiry < 0) expired = true;
    else if (daysToExpiry <= expiringWithinDays && s.status === 'APPROVED') expiringSoon = true;
  }

  return { id: s.id, overdue, daysOverdue, expiringSoon, daysToExpiry, expired };
}

export interface SanctionSummary {
  total: number;
  approved: number;
  open: number;
  overdue: number;
  expiringSoon: number;
  expired: number;
}

/** Roll a list up into the counts a dashboard tile shows. */
export function summariseSanctions(
  list: SanctionInput[],
  now: Date,
  expiringWithinDays = 60,
): SanctionSummary {
  const s: SanctionSummary = { total: list.length, approved: 0, open: 0, overdue: 0, expiringSoon: 0, expired: 0 };
  for (const item of list) {
    if (item.status === 'APPROVED') s.approved++;
    if (isOpen(item.status)) s.open++;
    const h = sanctionHealth(item, now, expiringWithinDays);
    if (h.overdue) s.overdue++;
    if (h.expiringSoon) s.expiringSoon++;
    if (h.expired) s.expired++;
  }
  return s;
}
