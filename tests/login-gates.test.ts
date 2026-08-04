import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { passwordPolicy } from '@/lib/auth/password';

const read = (p: string) => readFileSync(p, 'utf8');

/**
 * Every way into this application has to pass the same gates.
 *
 * The failures these lock down were all the same shape: a control written once,
 * placed on one route, and quietly absent from the others. Nothing looks wrong
 * when you read the file the control lives in — you have to ask which callers
 * reach it.
 */
describe('the login gates apply to every path, not just the first one (AMH-055)', () => {
  const auth = read('src/server/actions/auth.ts');

  it('the country, device and alert gates live in one place', () => {
    // Not inlined in `case 'ok'`, where a 2FA user never went.
    expect(auth).toMatch(/async function finishLogin\(/);
    const helper = auth.slice(auth.indexOf('async function finishLogin('), auth.indexOf('export async function loginAction'));
    expect(helper).toMatch(/countryAllowed\(/);
    expect(helper).toMatch(/beginDeviceApproval\(/);
    expect(helper).toMatch(/alertNewSignIn\(/);
    expect(helper).toMatch(/createSession\(/);
  });

  it('both the password path and the 2FA path go through it', () => {
    const calls = auth.match(/finishLogin\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(3); // the definition + two call sites

    const twoFactor = auth.slice(auth.indexOf('export async function verifyTwoFactorAction'));
    expect(twoFactor).toMatch(/return finishLogin\(/);
    // …and does NOT mint a session behind the helper's back.
    expect(twoFactor).not.toMatch(/await createSession\(/);
  });

  it('approving a device is not accepted in place of the second factor (AMH-056)', () => {
    const device = read('src/server/actions/device.ts');
    const gate = device.indexOf('user.twoFactorEnabled');
    const session = device.indexOf('await createSession(');
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(session); // the check has to come first, or it checks nothing
    expect(device).toMatch(/issueMfaTicket\(/);
  });
});

describe('one password floor, applied and advertised (AMH-057)', () => {
  it('is 12 characters', () => {
    expect(passwordPolicy.minLength).toBe(12);
  });

  it('self-signup runs the same strength and breach checks as every other path', () => {
    const signup = read('src/server/actions/signup.ts');
    expect(signup).toMatch(/validatePasswordStrength\(password\)/);
    expect(signup).toMatch(/breachVerdict\(password\)/);
    // …before the account exists, not after.
    expect(signup.indexOf('validatePasswordStrength')).toBeLessThan(signup.indexOf('prisma.user.create'));
  });

  it('no server schema accepts a shorter password than the policy', () => {
    const offenders: string[] = [];
    for (const f of readdirSync('src/server/actions')) {
      if (!f.endsWith('.ts')) continue;
      const src = read(join('src/server/actions', f));
      for (const line of src.split('\n')) {
        // Only password fields — `date: z.string().min(8)` is not one.
        if (!/password|passwd/i.test(line)) continue;
        const m = line.match(/z\.string\(\)\.min\((\d+)/);
        if (!m) continue;
        // `.min(1)` means "required" — it is the sign-in form checking an
        // EXISTING password, not a floor on a new one. Anything between 2 and
        // the policy is a second, weaker floor, which is the bug.
        const n = Number(m[1]);
        if (n > 1 && n < passwordPolicy.minLength) offenders.push(`${f}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no form promises the user a shorter password than the server will take', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!p.endsWith('.tsx')) continue;
        const src = read(p);
        if (!/password/i.test(src)) continue;
        for (const line of src.split('\n')) {
          const min = line.match(/minLength=\{(\d+)\}/);
          if (min && Number(min[1]) < passwordPolicy.minLength && /password/i.test(line)) offenders.push(`${p}: ${line.trim()}`);
          // Copy that states a number: "At least 8 characters", "Minimum 8 characters".
          const copy = line.match(/(?:At least|Minimum|Min) (\d+) characters/i);
          if (copy && Number(copy[1]) < passwordPolicy.minLength) offenders.push(`${p}: ${line.trim()}`);
        }
      }
    };
    walk('src/components');
    expect(offenders).toEqual([]);
  });
});
