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
describe('the login gates apply to every path, not just the first one (AMH-055 / AMH-067)', () => {
  const auth = read('src/server/actions/auth.ts');
  const slice = (name: string) => {
    const from = auth.indexOf(`async function ${name}(`);
    const next = auth.indexOf('\nasync function ', from + 1);
    const nextExport = auth.indexOf('\nexport async function ', from + 1);
    const ends = [next, nextExport].filter((n) => n > -1);
    return auth.slice(from, ends.length ? Math.min(...ends) : auth.length);
  };

  it('the country and device gates live in one place', () => {
    // Not inlined in `case 'ok'`, where a 2FA user never went.
    const gates = slice('runEntryGates');
    expect(gates).toMatch(/countryAllowed\(/);
    expect(gates).toMatch(/beginDeviceApproval\(/);
    // …and the gate function does NOT mint anything.
    expect(gates).not.toMatch(/createSession\(/);
  });

  it('the session, the history row and the alert live in the other place', () => {
    const complete = slice('completeLogin');
    expect(complete).toMatch(/createSession\(/);
    expect(complete).toMatch(/alertNewSignIn\(/);
    /*
     * AMH-067 — `markLoginSuccess` belongs AFTER the session exists.
     * `verifyTwoFactorAction` used to call it before the gates had spoken, so a
     * login refused on country or device still left a `success: true` row in
     * loginHistory beside a LOGIN_FAILED audit line. Anyone reading the login
     * history to answer "did somebody get in from Dubai?" read a yes for a
     * session that never existed.
     */
    expect(complete).toMatch(/markLoginSuccess\(/);
    expect(complete.indexOf('createSession(')).toBeLessThan(complete.indexOf('markLoginSuccess('));
  });

  it('the gates run BEFORE the second factor is asked for', () => {
    /*
     * AMH-067. They used to run after, which meant a 2FA user on a new laptop
     * entered an authenticator code, got bounced to /device-check, read the
     * emailed code, and was then asked for a SECOND authenticator code —
     * because verifyTotpOnce had already burned the first one. Three codes for
     * one sign-in.
     */
    const login = auth.slice(auth.indexOf('export async function loginAction'));
    const branch = login.slice(login.indexOf("case 'needs_2fa'"), login.indexOf("case 'ok'"));
    expect(branch).toMatch(/runEntryGates\(result\.user\)/);
    expect(branch.indexOf('runEntryGates')).toBeLessThan(branch.indexOf('issueMfaTicket'));
  });

  it('no path mints a session behind completeLogin\'s back', () => {
    // Only completeLogin may call createSession in this module.
    const callers = auth
      .split('\n')
      .filter((l) => /await createSession\(/.test(l) && !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'));
    expect(callers).toHaveLength(1);

    const twoFactor = auth.slice(auth.indexOf('export async function verifyTwoFactorAction'));
    expect(twoFactor).toMatch(/return completeLogin\(/);
    expect(twoFactor).not.toMatch(/await createSession\(/);
  });

  it('approving a device is not accepted in place of the second factor (AMH-056)', () => {
    const device = read('src/server/actions/device.ts');
    const gate = device.indexOf('user.twoFactorEnabled');
    const session = device.indexOf('await createSession(');
    expect(gate).toBeGreaterThan(-1);
    expect(gate).toBeLessThan(session); // the check has to come first, or it checks nothing
    expect(device).toMatch(/issueMfaTicket\(/);
    // AMH-068 — and a GUEST still lands on the sealed preview, like every other path.
    expect(device).toMatch(/if \(user\.role === 'GUEST'\) redirect\('\/demo'\)/);
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
    // …before the account exists, not after. Measured inside the function body,
    // because the first occurrence in the file is the import statement — which
    // is why the previous version of this assertion was tautological.
    const body = signup.slice(signup.indexOf('export async function signupAction'));
    expect(body.indexOf('validatePasswordStrength(password)')).toBeGreaterThan(-1);
    expect(body.indexOf('validatePasswordStrength(password)')).toBeLessThan(body.indexOf('prisma.user.create'));

    /*
     * AMH-069 — and the cheap local checks come before the network one. The
     * breach check is an outbound call with a 4s timeout; running it before the
     * "is signup even on?" gate let an unauthenticated caller hold a socket
     * open per request against a feature nobody had switched on.
     */
    expect(body.indexOf('checkRate(`signup:ip:')).toBeGreaterThan(-1);
    expect(body.indexOf('checkRate(`signup:ip:')).toBeLessThan(body.indexOf('getSignupConfig()'));
    expect(body.indexOf('getSignupConfig()')).toBeLessThan(body.indexOf('breachVerdict(password)'));
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
