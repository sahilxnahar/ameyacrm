/**
 * A twelve-week rolling cash forecast, kept pure and timezone-safe.
 *
 * The useful question is not "how much is in the bank" but "when does it run
 * out". Committed money going out (approved bills, scheduled repayments) is set
 * against expected money coming in (buyer demands due, invoices outstanding),
 * week by week, so the lowest point in the horizon — the moment that actually
 * matters — is a number the screen already knows.
 *
 * Everything works in whole rupees on signed flows (+ in, − out). `now` is
 * always passed in; the handover records a real bug from a function that built
 * its own date in a different timezone than the test.
 */

export interface Flow {
  date: Date;
  /** Positive is money in, negative is money out. */
  amount: number;
  label?: string;
}

export interface WeekBucket {
  index: number;
  weekStart: Date;
  inflow: number;
  outflow: number;
  net: number;
  /** Bank position at the end of this week. */
  closing: number;
}

export interface Forecast {
  opening: number;
  buckets: WeekBucket[];
  closing: number;
  /** The lowest closing position across the horizon — the number that decides
   *  whether a payment run is safe. */
  lowestPoint: number;
  lowestWeekIndex: number;
}

const DAY = 86_400_000;

/** Midnight UTC of the Monday on or before `d`. Weeks are Monday-based because
 *  site and office weeks are. */
export function startOfWeek(d: Date): Date {
  const u = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const dow = new Date(u).getUTCDay(); // 0 = Sunday
  const backToMonday = (dow + 6) % 7;
  return new Date(u - backToMonday * DAY);
}

const r0 = (n: number) => Math.round(n);

/**
 * Bucket flows into `weeks` weekly columns from the current week.
 *
 * A flow dated before this week (an overdue demand, a bill already past due) is
 * folded into week 0 rather than dropped — it is still cash that has to move,
 * and pretending otherwise is how a forecast flatters. A flow beyond the
 * horizon is ignored and its absence is the caller's to note.
 */
export function rollingForecast(now: Date, opening: number, flows: Flow[], weeks = 12): Forecast {
  const week0 = startOfWeek(now);
  const buckets: WeekBucket[] = [];
  for (let i = 0; i < weeks; i++) {
    buckets.push({
      index: i,
      weekStart: new Date(week0.getTime() + i * 7 * DAY),
      inflow: 0,
      outflow: 0,
      net: 0,
      closing: 0,
    });
  }

  for (const f of flows) {
    const fStart = startOfWeek(f.date);
    let idx = Math.round((fStart.getTime() - week0.getTime()) / (7 * DAY));
    if (idx < 0) idx = 0; // overdue folds into the current week
    if (idx >= weeks) continue; // beyond the horizon
    const b = buckets[idx]!;
    if (f.amount >= 0) b.inflow += f.amount;
    else b.outflow += -f.amount;
  }

  let running = opening;
  let lowestPoint = opening;
  let lowestWeekIndex = -1;
  for (const b of buckets) {
    b.inflow = r0(b.inflow);
    b.outflow = r0(b.outflow);
    b.net = b.inflow - b.outflow;
    running += b.net;
    b.closing = r0(running);
    if (b.closing < lowestPoint) {
      lowestPoint = b.closing;
      lowestWeekIndex = b.index;
    }
  }

  return {
    opening: r0(opening),
    buckets,
    closing: r0(running),
    lowestPoint: r0(lowestPoint),
    lowestWeekIndex,
  };
}
