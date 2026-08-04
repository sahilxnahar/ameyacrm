import { format, formatDistanceToNow, isValid } from 'date-fns';

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

export function formatCurrency(value: number | string | null | undefined): string {
  if (value == null) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? inr.format(n) : '—';
}

/**
 * Money the way people here actually say it: crores and lakhs, not a wall of
 * digits. Use for headline figures (KPIs, tiles). Keep `formatCurrency` for
 * places that must show the exact rupee — put the exact value in a tooltip.
 */
export function formatCompactCurrency(value: number | string | null | undefined): string {
  if (value == null) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const trim = (x: number) => x.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)} Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)} L`;
  if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)}k`;
  return formatCurrency(n);
}

/** The exact rupee figure, for a tooltip beside a compact one. */
export function formatExactCurrency(value: number | string | null | undefined): string {
  return formatCurrency(value);
}

/*
 * Dates render in IST, not in whatever zone the runtime happens to be.
 *
 * date-fns `format` renders in runtime-local. In a Server Component that is the
 * server's zone, which was UTC — so every timestamp in the product displayed
 * 5h30m early, and anything between 18:30 and midnight IST showed the PREVIOUS
 * DATE. On an audit trail or a statutory register that is not a display bug.
 *
 * `TZ=Asia/Kolkata` is now set on the container and on Vercel, which fixes it at
 * the source. This is the belt to that pair of braces: it stays correct even if
 * the code runs somewhere the environment was not configured — a developer
 * machine, a one-off script, a future host.
 */
const IST = 'Asia/Kolkata';

/** Shift an instant so that formatting it as if it were local yields IST. */
function asIst(date: Date): Date {
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60_000;
  return new Date(utcMs + 330 * 60_000); // UTC+05:30, no daylight saving
}

export function formatDate(d: Date | string | null | undefined, pattern = 'dd MMM yyyy'): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return isValid(date) ? format(asIst(date), pattern) : '—';
}

export function formatDateTime(d: Date | string | null | undefined): string {
  return formatDate(d, 'dd MMM yyyy, h:mm a');
}

/** The IANA zone every date in this product is expressed in. */
export const DISPLAY_TIMEZONE = IST;

export function timeAgo(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return isValid(date) ? formatDistanceToNow(date, { addSuffix: true }) : '—';
}

export function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
