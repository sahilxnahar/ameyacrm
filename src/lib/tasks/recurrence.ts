/** How a repeating task is described and when the next one is due. */
export const REPEAT_UNITS = [
  { key: 'DAY', label: 'day' },
  { key: 'WEEK', label: 'week' },
  { key: 'MONTH', label: 'month' },
  { key: 'YEAR', label: 'year' },
] as const;

export type RepeatUnit = (typeof REPEAT_UNITS)[number]['key'];

/**
 * The next due date after a repeat.
 *
 * Counted from the date the task was due, not the date it was finished —
 * otherwise a monthly job done three days late slides later every month until
 * it drifts into the wrong month entirely.
 */
export function nextDueDate(from: Date, every: number, unit: RepeatUnit): Date {
  const n = Math.max(1, Math.round(every));
  const d = new Date(from);
  switch (unit) {
    case 'DAY': d.setDate(d.getDate() + n); break;
    case 'WEEK': d.setDate(d.getDate() + n * 7); break;
    case 'YEAR': d.setFullYear(d.getFullYear() + n); break;
    case 'MONTH': {
      // "31 January, monthly" must land on 28 February, not 3 March.
      const day = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + n);
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, lastDay));
      break;
    }
  }
  return d;
}

/** "Every 2 weeks", "Every month" — for showing on a task. */
export function describeRepeat(every: number | null, unit: string | null): string | null {
  if (!every || !unit) return null;
  const label = REPEAT_UNITS.find((u) => u.key === unit)?.label ?? unit.toLowerCase();
  return every === 1 ? `Every ${label}` : `Every ${every} ${label}s`;
}
