/**
 * Hold-point gating and safety/permit roll-ups, kept pure and timezone-safe.
 *
 * A hold point is an inspection that work may not proceed past until it passes —
 * reinforcement before the pour, waterproofing before it is covered. This is
 * what makes the programme's "100% complete" trustworthy: an activity with an
 * open or failed hold point is not done, whatever the percentage says. The
 * gating logic lives here, pure, so it can be tested without a database, and it
 * is the check the certify path is expected to consult.
 */

export type InspectionStatus = 'SCHEDULED' | 'PASSED' | 'FAILED';

export interface InspectionInput {
  id: string;
  isHoldPoint: boolean;
  status: InspectionStatus;
}

export interface HoldPointState {
  /** True if any hold point is unpassed (scheduled or failed). Certification of
   *  the activity should be refused while this is true. */
  blocked: boolean;
  openHoldPoints: number;
  failedHoldPoints: number;
  totalHoldPoints: number;
}

export function holdPointState(inspections: InspectionInput[]): HoldPointState {
  const holds = inspections.filter((i) => i.isHoldPoint);
  const failed = holds.filter((i) => i.status === 'FAILED').length;
  const open = holds.filter((i) => i.status === 'SCHEDULED').length;
  return {
    blocked: failed + open > 0,
    openHoldPoints: open,
    failedHoldPoints: failed,
    totalHoldPoints: holds.length,
  };
}

/**
 * Whether an activity may be certified complete.
 *
 * Two conditions: the reported progress is 100, and no hold point is standing in
 * the way. Returning the reason keeps the caller's error message specific — "a
 * hold-point inspection has not passed" is worth more than "cannot certify".
 */
export function canCertify(percentComplete: number, inspections: InspectionInput[]): { ok: boolean; reason: string | null } {
  if (percentComplete < 100) return { ok: false, reason: 'Work is not reported 100% complete.' };
  const hp = holdPointState(inspections);
  if (hp.failedHoldPoints > 0) return { ok: false, reason: `${hp.failedHoldPoints} hold-point inspection(s) have failed and must be rectified.` };
  if (hp.openHoldPoints > 0) return { ok: false, reason: `${hp.openHoldPoints} hold-point inspection(s) have not yet passed.` };
  return { ok: true, reason: null };
}

// ── Safety roll-up ───────────────────────────────────────────────────────────

export type SafetyKind = 'INCIDENT' | 'NEAR_MISS' | 'TOOLBOX_TALK';

export interface SafetyInput {
  kind: SafetyKind;
  occurredOn: Date;
}

export interface SafetySummary {
  incidents: number;
  nearMisses: number;
  toolboxTalks: number;
  /** Whole days since the most recent incident, or null if there has never been one. */
  daysSinceLastIncident: number | null;
}

const DAY = 86_400_000;
function daysBetween(now: Date, then: Date): number {
  const a = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const b = Date.UTC(then.getUTCFullYear(), then.getUTCMonth(), then.getUTCDate());
  return Math.round((a - b) / DAY);
}

export function summariseSafety(records: SafetyInput[], now: Date): SafetySummary {
  let incidents = 0, nearMisses = 0, toolboxTalks = 0;
  let lastIncident: Date | null = null;
  for (const r of records) {
    if (r.kind === 'INCIDENT') {
      incidents++;
      if (!lastIncident || r.occurredOn.getTime() > lastIncident.getTime()) lastIncident = r.occurredOn;
    } else if (r.kind === 'NEAR_MISS') nearMisses++;
    else toolboxTalks++;
  }
  return {
    incidents, nearMisses, toolboxTalks,
    daysSinceLastIncident: lastIncident ? Math.max(0, daysBetween(now, lastIncident)) : null,
  };
}

// ── Permit validity ──────────────────────────────────────────────────────────

export interface PermitInput {
  id: string;
  status: 'OPEN' | 'CLOSED' | 'EXPIRED';
  validTo: Date | null;
}

/** An open permit whose window has passed is effectively expired — surfaced so a
 *  permit is closed on time rather than left dangling. */
export function permitIsExpired(p: PermitInput, now: Date): boolean {
  if (p.status !== 'OPEN' || !p.validTo) return p.status === 'EXPIRED';
  return daysBetween(now, p.validTo) > 0; // validTo strictly before today
}
