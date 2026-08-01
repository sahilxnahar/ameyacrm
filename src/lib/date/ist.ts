/**
 * Indian date handling, in one place.
 *
 * Two things repeatedly go wrong in this codebase's date logic, and both are
 * invisible until they cost money:
 *
 *  1. `new Date().toISOString()` is UTC. Between midnight and 05:30 IST that is
 *     still *yesterday*, so a voucher entered late at night defaults to the wrong
 *     day — and if that night is 31 March, into the wrong financial year.
 *  2. Period bounds built with `new Date(y, m, d)` are browser-local midnight.
 *     Serialised to UTC from IST that becomes 18:30 on the *previous* day, so a
 *     `date <= to` query silently drops everything dated on the last day of the
 *     period. "This FY" was excluding 31 March — the busiest booking day of the
 *     Indian accounting year.
 *
 * Voucher dates are stored as UTC midnight of the calendar day the user picked,
 * so all bounds here are built in UTC to match.
 */

export const IST_OFFSET_MINUTES = 330; // UTC+05:30, no daylight saving

/** The calendar date it is *in India* right now, as YYYY-MM-DD. */
export function todayISTISO(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000).toISOString().slice(0, 10);
}

/** The Y/M/D it is in India, for building period bounds. */
export function istParts(now: Date = new Date()): { y: number; m: number; d: number } {
  const s = new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);
  return { y: s.getUTCFullYear(), m: s.getUTCMonth(), d: s.getUTCDate() };
}

/** First instant of a calendar day, matching how voucher dates are stored. */
export function startOfDayUTC(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
}

/** Last instant of a calendar day — inclusive upper bound for `lte` queries. */
export function endOfDayUTC(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
}

/** Start of today in India, as an instant. Anything before this is a past day. */
export function startOfTodayIST(now: Date = new Date()): Date {
  const { y, m, d } = istParts(now);
  return startOfDayUTC(y, m, d);
}

/** End of today in India — used so "overdue" only bites once the day is over. */
export function endOfTodayIST(now: Date = new Date()): Date {
  const { y, m, d } = istParts(now);
  return endOfDayUTC(y, m, d);
}

/**
 * The Indian financial year containing `now`: 1 April → 31 March.
 * `startYear` 2025 means FY 2025-26.
 */
export function indianFY(now: Date = new Date()): { startYear: number; from: Date; to: Date; label: string } {
  const { y, m } = istParts(now);
  const startYear = m >= 3 ? y : y - 1; // month 3 === April
  return {
    startYear,
    from: startOfDayUTC(startYear, 3, 1),
    to: endOfDayUTC(startYear + 1, 2, 31),
    label: `FY ${startYear}-${String(startYear + 1).slice(2)}`,
  };
}

/**
 * The Indian financial quarter: Q1 is Apr–Jun, NOT Jan–Mar.
 * Calendar-quarter maths labelled as FY quarters is off by one every time — in
 * July it would report "Q3" for what Indian accounting calls Q2.
 */
export function indianQuarter(now: Date = new Date()): { q: 1 | 2 | 3 | 4; from: Date; to: Date; label: string } {
  const { y, m } = istParts(now);
  const fyStartYear = m >= 3 ? y : y - 1;
  const monthsIntoFY = (m - 3 + 12) % 12;          // April → 0
  const q = (Math.floor(monthsIntoFY / 3) + 1) as 1 | 2 | 3 | 4;
  const startMonthAbs = 3 + (q - 1) * 3;            // absolute month index from April
  const fromY = fyStartYear + Math.floor(startMonthAbs / 12);
  const fromM = startMonthAbs % 12;
  const endMonthAbs = startMonthAbs + 3;
  const toY = fyStartYear + Math.floor(endMonthAbs / 12);
  const toM = endMonthAbs % 12;
  return {
    q,
    from: startOfDayUTC(fromY, fromM, 1),
    to: endOfDayUTC(toY, toM, 0),                   // day 0 = last day of previous month
    label: `Q${q} FY${String(fyStartYear + 1).slice(2)}`,
  };
}

/** The current calendar month in India. */
export function istMonth(now: Date = new Date()): { from: Date; to: Date; label: string } {
  const { y, m } = istParts(now);
  return {
    from: startOfDayUTC(y, m, 1),
    to: endOfDayUTC(y, m + 1, 0),
    label: new Date(Date.UTC(y, m, 1)).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
  };
}

/** Parse a YYYY-MM-DD from a date input into the stored UTC-midnight form. */
export function dateInputToUTC(value: string, endOfDay = false): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  return endOfDay ? endOfDayUTC(y, mo, d) : startOfDayUTC(y, mo, d);
}
