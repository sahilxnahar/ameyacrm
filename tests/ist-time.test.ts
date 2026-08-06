import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { datetimeLocalToUTC, toDatetimeLocalIST } from '../src/lib/date/ist';
import { formatDate, formatDateTime } from '../src/lib/utils/format';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

/*
 * The whole product was 5 hours 30 minutes wrong.
 *
 * TZ was set nowhere, so the server ran UTC while every user is in IST. Two
 * separate consequences, both reproduced during the August 2026 audit:
 *
 *   1. `<input type="datetime-local">` submits a bare wall-clock string with no
 *      offset. `new Date(s)` resolved it in the runtime zone, so a reminder set
 *      for 15:30 was stored as 15:30Z and fired at 21:00 IST.
 *   2. date-fns `format` renders in runtime-local, so in a Server Component
 *      every displayed timestamp was 5h30m early — and anything entered between
 *      18:30 and midnight IST appeared under the PREVIOUS DATE. On a statutory
 *      register that is a compliance problem, not a cosmetic one.
 *
 * These tests are written to pass regardless of the machine's TZ, because that
 * is the property that was missing: correctness must not depend on the host
 * being configured.
 */
describe('a datetime-local value is read as the IST the person meant', () => {
  it('3:30 PM means 3:30 PM in India', () => {
    const d = datetimeLocalToUTC('2026-08-04T15:30');
    expect(d?.toISOString()).toBe('2026-08-04T10:00:00.000Z');
    expect(d?.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }))
      .toBe('15:30');
  });

  it('round-trips back into the input unchanged', () => {
    // Re-opening a saved record must show what was typed, not a shifted time.
    const d = datetimeLocalToUTC('2026-08-04T15:30');
    expect(toDatetimeLocalIST(d)).toBe('2026-08-04T15:30');
  });

  it('accepts the seconds-bearing form some browsers send', () => {
    expect(datetimeLocalToUTC('2026-08-04T15:30:00')?.toISOString()).toBe('2026-08-04T10:00:00.000Z');
  });

  it('does not double-shift a value that already carries an offset', () => {
    // Trusting an explicit offset matters: an API caller may send a real
    // timestamp, and adding 5:30 to it would corrupt it.
    expect(datetimeLocalToUTC('2026-08-04T10:00:00.000Z')?.toISOString()).toBe('2026-08-04T10:00:00.000Z');
    expect(datetimeLocalToUTC('2026-08-04T15:30:00+05:30')?.toISOString()).toBe('2026-08-04T10:00:00.000Z');
  });

  it('returns null rather than an Invalid Date', () => {
    // Storing an Invalid Date is how a reminder silently never fires.
    expect(datetimeLocalToUTC('')).toBeNull();
    expect(datetimeLocalToUTC(null)).toBeNull();
    expect(datetimeLocalToUTC('not a date')).toBeNull();
  });
});

describe('an evening entry is filed under the right day', () => {
  it('7:45 PM IST shows as that day, not the one before', () => {
    const evening = new Date('2026-08-04T19:45:00+05:30');
    expect(formatDate(evening)).toBe('04 Aug 2026');
    expect(formatDateTime(evening)).toBe('04 Aug 2026, 7:45 PM');
  });

  it('just before midnight IST is still the same date', () => {
    const late = new Date('2026-08-04T23:59:00+05:30');
    expect(formatDate(late)).toBe('04 Aug 2026');
  });

  it('just after midnight IST has rolled over', () => {
    const early = new Date('2026-08-05T00:01:00+05:30');
    expect(formatDate(early)).toBe('05 Aug 2026');
  });
});

describe('the timezone is pinned where it runs', () => {
  it('the container sets TZ', () => {
    // Belt: the environment is correct.
    expect(read('Dockerfile')).toMatch(/TZ=Asia\/Kolkata/);
  });

  it('Vercel does not set TZ (reserved by the platform)', () => {
    // Vercel rejects TZ as a reserved environment variable, so it cannot be
    // set in vercel.json. The Dockerfile sets it for self-hosted deploys, and
    // the formatting code is TZ-independent (see the next test), so this is
    // belt-and-braces rather than a load-bearing configuration.
    const v = JSON.parse(read('vercel.json'));
    expect(v.env?.TZ ?? v.build?.env?.TZ).toBeUndefined();
  });

  it('formatting does not rely on that anyway', () => {
    // Braces: the code is correct even where the environment is not. This is
    // the property that actually failed — the host was never configured.
    expect(read('src/lib/utils/format.ts')).toContain('asIst');
    expect(read('src/lib/utils/format.ts')).not.toMatch(/return isValid\(date\) \? format\(date,/);
  });

  it('no action still parses a datetime-local with a bare new Date()', () => {
    const offenders: string[] = [];
    for (const f of ['reminders', 'marketing', 'field-ops', 'calendar']) {
      const src = read(`src/server/actions/${f}.ts`);
      if (!src.includes('datetimeLocalToUTC')) offenders.push(f);
    }
    expect(offenders, `still parsing wall-clock in server time: ${offenders.join(', ')}`).toEqual([]);
  });
});
