/**
 * Generate a readable temporary password for admin-issued resets.
 *
 * Pure and client-safe (no `server-only`, no node imports) so it is unit
 * tested. Hashing and storage happen in the server action. The alphabet leaves
 * out visually ambiguous characters (0/O, 1/l/I) so someone can read it off a
 * screen and type it without confusion, and it always satisfies the project's
 * password policy (see MIN_LENGTH below, no complexity rules).
 */

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'; // no I, l, O, o
const DIGITS = '23456789'; // no 0, 1
/**
 * AMH-057 — kept in step with `passwordPolicy.minLength` in lib/auth/password.ts,
 * which cannot be imported here: this module is deliberately client-safe and
 * that one is `server-only`. tests/temp-password.test.ts asserts the two agree,
 * so raising the policy without raising this fails the build rather than
 * quietly issuing system passwords weaker than any a person is allowed to pick.
 */
const MIN_LENGTH = 12;
const DEFAULT_LENGTH = 14;

/** Uniform index in [0, max) using the platform CSPRNG when available. */
function defaultPick(max: number): number {
  const g = globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } };
  if (g.crypto?.getRandomValues) {
    const a = new Uint32Array(1);
    g.crypto.getRandomValues(a);
    return (a[0] ?? 0) % max;
  }
  return Math.floor(Math.random() * max);
}

/**
 * A `length`-character password (default 10) drawn from the readable alphabet,
 * guaranteed to contain at least two digits and the rest letters, then shuffled.
 * Pass a custom `pick` (index chooser) to make output deterministic in tests.
 */
export function generateTempPassword(length: number = DEFAULT_LENGTH, pick: (max: number) => number = defaultPick): string {
  const len = Math.max(MIN_LENGTH, Math.floor(length));
  const chars: string[] = [];
  // Two digits for a little entropy variety and readability.
  for (let i = 0; i < 2; i++) chars.push(DIGITS[pick(DIGITS.length)] ?? '2');
  // The rest are letters.
  for (let i = chars.length; i < len; i++) chars.push(LETTERS[pick(LETTERS.length)] ?? 'A');
  // Fisher–Yates shuffle so the digits are not always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    const tmp = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = tmp;
  }
  return chars.join('');
}
