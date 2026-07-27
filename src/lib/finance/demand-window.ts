/**
 * Pure date logic for payment dunning (module #4), kept out of the DB service so
 * the "is it due yet / is it overdue" decision is unit-testable to the day.
 */
export const DEMAND_UPCOMING_WINDOW_DAYS = 7;

export function endOfDay(d: Date): Date { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
export function addDays(d: Date, n: number): Date { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

/** Overdue once the due moment has passed; otherwise an upcoming reminder. */
export function classifyDemandKind(due: Date, now: Date): 'OVERDUE' | 'UPCOMING' {
  return due.getTime() < now.getTime() ? 'OVERDUE' : 'UPCOMING';
}

/** A milestone is in scope if it is already overdue OR falls due within the window. */
export function isInDemandScope(due: Date, now: Date, windowDays = DEMAND_UPCOMING_WINDOW_DAYS): boolean {
  return due.getTime() <= endOfDay(addDays(now, windowDays)).getTime();
}
