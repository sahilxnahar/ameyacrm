import { format, formatDistanceToNow, isValid } from 'date-fns';

/*
 * ── One way to write money (AMH-035) ────────────────────────────────────────
 *
 * Counted in the August 2026 audit: 28 distinct ad-hoc money formats across the
 * product, most of them a local `const inr = …` defined in whichever file
 * needed one. They disagreed, and measurably:
 *
 *     amount        canonical      local `inr`     2-decimal local
 *     150000.5      ₹1,50,001      ₹1,50,001       ₹1,50,000.50
 *     0.5           ₹1             ₹1              ₹0.50
 *     -2500.75      -₹2,501        ₹-2,501         ₹-2,500.75
 *
 * Two real problems in there, not just untidiness.
 *
 *   The sign moves. `-₹2,501` on one screen and `₹-2,501` on the next.
 *
 *   Fifty paise becomes a rupee. At `maximumFractionDigits: 0` two amounts that
 *   differ by up to 99 paise render IDENTICALLY — so a reconciliation screen
 *   can show two equal-looking figures beside a difference column that says
 *   ₹0.50, and the person reading it concludes the software is broken. On
 *   GSTR-2B matching, that is exactly the column that decides whether input
 *   credit is claimed.
 *
 * So: whole rupees print clean, and paise print when there are paise. No
 * silent rounding, no decimal noise on the 99% of amounts that are whole.
 */
const inrWhole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrPaise = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const plainPaise = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * The exact amount. Use anywhere a figure has to reconcile against another one.
 *
 * Shows paise only when the amount has paise, so a bill of ₹1,50,000 does not
 * become ₹1,50,000.00 on every screen while ₹1,50,000.50 still reads correctly.
 */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value == null) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  // Rounded to paise first: 0.005 of floating-point drift must not flip a whole
  // rupee into a two-decimal render.
  const paise = Math.round(n * 100);
  return paise % 100 === 0 ? inrWhole.format(paise / 100) : inrPaise.format(paise / 100);
}

/**
 * Two decimals, NO currency symbol.
 *
 * Tally's own amount columns show bare numbers with the symbol in the heading,
 * and the ledger views here follow it. Named rather than hand-rolled per file
 * so "no symbol" stays a deliberate choice and not an omission.
 */
export function formatAmountPlain(value: number | string | null | undefined): string {
  if (value == null) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? plainPaise.format(n) : '—';
}

/**
 * `Rs 1,50,000.00` — for PDFs and for text handed to the AI index.
 *
 * The ₹ glyph is absent from the standard PDF base fonts, so a document
 * generated with it renders a blank box or a random glyph where the amount's
 * currency should be. This is not a style preference; it is the one place the
 * symbol genuinely cannot be used.
 */
export function formatCurrencyForPdf(value: number | string | null | undefined): string {
  if (value == null) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? `Rs ${plainPaise.format(n)}` : '—';
}

/**
 * Always two decimals. For columns that must line up digit-for-digit — a
 * ledger, a reconciliation, an exported statement.
 */
export function formatCurrencyExact(value: number | string | null | undefined): string {
  if (value == null) return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(n) ? inrPaise.format(n) : '—';
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
  // Below a thousand there is nothing to compact — fall through to the exact one.
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
