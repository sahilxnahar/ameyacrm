/**
 * Pure trademark date logic (module #81). A registered Indian trademark is valid
 * for 10 years from the date of registration and renewable in 10-year blocks
 * (Trade Marks Act 1999, s.25). Kept out of the DB layer so the renewal-due
 * computation is unit-testable to the day.
 */
export const TM_TERM_YEARS = 10;

/** Renewal falls due exactly TM_TERM_YEARS after registration. */
export function renewalDueDate(registeredOn: Date): Date {
  const d = new Date(registeredOn);
  d.setFullYear(d.getFullYear() + TM_TERM_YEARS);
  return d;
}

/** True when the renewal date is within `alertDays` of `now` (or already past). */
export function isRenewalApproaching(renewalDueOn: Date, now: Date, alertDays = 180): boolean {
  const horizon = new Date(now.getTime() + alertDays * 864e5);
  return renewalDueOn.getTime() <= horizon.getTime();
}

/** A short human label for how far off the renewal is. */
export function renewalLabel(renewalDueOn: Date, now: Date): string {
  const days = Math.round((renewalDueOn.getTime() - now.getTime()) / 864e5);
  if (days < 0) return `overdue by ${Math.abs(days)}d`;
  if (days === 0) return 'due today';
  if (days < 60) return `due in ${days}d`;
  return `due in ${Math.round(days / 30)}mo`;
}
