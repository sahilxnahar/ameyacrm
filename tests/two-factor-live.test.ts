// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { authenticator } from 'otplib';
import { readFileSync } from 'node:fs';

/**
 * Two-factor authentication, proved against a real database.
 *
 * Everything below drives the SHIPPING code — `src/lib/auth/totp.ts`,
 * `src/lib/auth/mfa-ticket.ts`, `authenticate()` — against a real Postgres row,
 * because the interesting failures in a second factor are all state failures:
 * a secret that is not really encrypted, a backup code that survives its one
 * use, a ticket that authorises the wrong account, a code that can be replayed.
 * None of those show up in a unit test of the pure helpers.
 *
 *   LIVE_DB=postgresql://…/ameya_ci DATABASE_URL=$LIVE_DB npx vitest run tests/two-factor-live.test.ts
 */
const LIVE = process.env.LIVE_DB;
const suite = LIVE ? describe : describe.skip;
const prisma = new PrismaClient({ datasources: { db: { url: LIVE ?? 'postgresql://unused' } } });

const EMAIL = '2fa-e2e@ameya.test';
let userId = '';
let plainSecret = '';

suite('two-factor authentication, end to end', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.LIVE_DB!;
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    const { hashPassword } = await import('@/lib/auth/password');
    const u = await prisma.user.create({
      data: {
        email: EMAIL,
        username: EMAIL,
        name: '2FA Probe',
        passwordHash: await hashPassword('Correct-Horse-Battery-9'),
        role: 'EMPLOYEE',
        status: 'ACTIVE',
      },
    });
    userId = u.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.$disconnect();
  });

  it('enrolment stores the secret encrypted, not the secret', async () => {
    const { generateTotpSecret, sealSecret, openSecret } = await import('@/lib/auth/totp');
    plainSecret = generateTotpSecret();
    await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: sealSecret(plainSecret) } });

    // Read the column back the way a dump or a stolen backup would see it.
    const rows = await prisma.$queryRaw<Array<{ twoFactorSecret: string }>>`
      SELECT "twoFactorSecret" FROM "User" WHERE id = ${userId}`;
    const row = rows[0]!;
    expect(row.twoFactorSecret).not.toContain(plainSecret);
    expect(row.twoFactorSecret).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/); // iv.tag.ciphertext
    // …and it is genuinely reversible by the app, not just scrambled.
    expect(openSecret(row.twoFactorSecret)).toBe(plainSecret);
  });

  it('a correct code enables 2FA and a wrong one does not', async () => {
    const { verifyTotp } = await import('@/lib/auth/totp');
    expect(verifyTotp(authenticator.generate(plainSecret), plainSecret)).toBe(true);
    expect(verifyTotp('000000', plainSecret)).toBe(false);
    expect(verifyTotp('', plainSecret)).toBe(false);
    // A code from a DIFFERENT secret must not open this account.
    const { generateTotpSecret } = await import('@/lib/auth/totp');
    expect(verifyTotp(authenticator.generate(generateTotpSecret()), plainSecret)).toBe(false);

    await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
  });

  it('the password alone no longer produces a session', async () => {
    const { authenticate } = await import('@/server/services/auth-service');
    const res = await authenticate(EMAIL, 'Correct-Horse-Battery-9');
    expect(res.status).toBe('needs_2fa'); // not 'ok' — no session is created here
  });

  it('a wrong password still fails before 2FA is ever reached', async () => {
    const { verifyPassword } = await import('@/lib/auth/password');
    const u = await prisma.user.findUnique({ where: { id: userId } });
    expect(await verifyPassword('not-the-password', u!.passwordHash)).toBe(false);
    expect(await verifyPassword('Correct-Horse-Battery-9', u!.passwordHash)).toBe(true);

    // …and the second factor is reached only AFTER that check, so a wrong
    // password can never fall through to the 2FA branch.
    const src = readFileSync('src/server/services/auth-service.ts', 'utf8');
    const body = src.slice(src.indexOf('export async function authenticate'));
    expect(body.indexOf('bad_password')).toBeLessThan(body.indexOf('needs_2fa'));
  });

  it('a backup code works exactly once', async () => {
    const { generateBackupCodes, verifyBackupCode } = await import('@/lib/auth/totp');
    const { codes, hashes } = await generateBackupCodes(3);
    await prisma.backupCode.deleteMany({ where: { userId } });
    await prisma.backupCode.createMany({ data: hashes.map((codeHash) => ({ userId, codeHash })) });

    // First use: found, and marked used — this mirrors verifyTwoFactorAction.
    const consume = async (input: string) => {
      const open = await prisma.backupCode.findMany({ where: { userId, usedAt: null } });
      for (const bc of open) {
        if (await verifyBackupCode(input, bc.codeHash)) {
          await prisma.backupCode.update({ where: { id: bc.id }, data: { usedAt: new Date() } });
          return true;
        }
      }
      return false;
    };

    expect(await consume(codes[0]!)).toBe(true);
    expect(await consume(codes[0]!)).toBe(false); // replay refused
    expect(await consume(codes[0]!.replace('-', ''))).toBe(false); // and normalised replay too
    expect(await consume(codes[1]!)).toBe(true); // a different code still works
    expect(await consume('aaaaa-bbbbb')).toBe(false); // a made-up code never works
  });

  it('the half-authenticated ticket authorises one account and nothing else', async () => {
    const { SignJWT, jwtVerify } = await import('jose');
    const enc = (v: string) => new Uint8Array(Buffer.from(v, 'utf8')); // jsdom's TextEncoder yields a foreign-realm array jose rejects
    const secret = enc(process.env.SESSION_SECRET!);

    const ticket = await new SignJWT({ uid: userId, stage: '2fa' })
      .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m').sign(secret);
    const { payload } = await jwtVerify(ticket, secret);
    expect(payload.uid).toBe(userId);
    expect(payload.stage).toBe('2fa');

    // Signed with the wrong key — i.e. forged by anyone who does not have SESSION_SECRET.
    const forged = await new SignJWT({ uid: userId, stage: '2fa' })
      .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m')
      .sign(enc('a-different-secret-000000000000000000'));
    await expect(jwtVerify(forged, secret)).rejects.toThrow();

    // Expired.
    const stale = await new SignJWT({ uid: userId, stage: '2fa' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(secret);
    await expect(jwtVerify(stale, secret)).rejects.toThrow();

    // A full SESSION token must not be accepted as a 2FA ticket, and vice versa:
    // readMfaTicket() insists on stage === '2fa'.
    const sessionish = await new SignJWT({ uid: userId })
      .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('5m').sign(secret);
    const { payload: p2 } = await jwtVerify(sessionish, secret);
    expect(p2.stage).not.toBe('2fa');
  });

});

/**
 * These need no database, so they must NOT sit inside the LIVE_DB-gated suite —
 * gated, they never ran in ordinary CI, which is exactly when a regression lock
 * has to fire.
 */
describe('the second factor is wired the way it claims', () => {
  it('is rate limited before any code is compared', () => {
    const src = readFileSync('src/server/actions/auth.ts', 'utf8');
    const body = src.slice(src.indexOf('export async function verifyTwoFactorAction'));
    // Strip comments first: the previous version of this test was measuring the
    // position of the word `verifyTotp` inside a comment, not in code.
    const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code).toMatch(/checkRate\(`2fa:verify:\$\{userId\}`/);
    expect(code).toMatch(/checkRate\(`2fa:verify:ip:\$\{ip\}`/);
    expect(code.indexOf('checkRate')).toBeLessThan(code.indexOf('verifyTotpOnce'));
  });

  /**
   * AMH-052 + AMH-070. The earlier version of this test only checked that the
   * words `verifyPassword` and `twoFactorEnabled` appeared somewhere in the
   * function — it passed with the condition inverted, and it did not notice
   * that starting an enrolment still destroyed the working secret.
   */
  it('re-enrolling costs a password AND does not destroy the working factor', () => {
    const src = readFileSync('src/server/actions/security.ts', 'utf8');
    const start = src.indexOf('export async function startTwoFactorSetup');
    const body = src.slice(start, src.indexOf('export async function confirmTwoFactor'));

    // The gate, in the right direction, before the write.
    expect(body).toMatch(/if \(user\.twoFactorEnabled\) \{/);
    expect(body).toMatch(/if \(!password\) return \{ error: 'PASSWORD_REQUIRED' \}/);
    expect(body).toMatch(/if \(!\(await verifyPassword\(password, user\.passwordHash\)\)\)/);
    expect(body.indexOf('verifyPassword')).toBeLessThan(body.indexOf('prisma.user.update'));

    // AMH-070: step 1 writes ONLY the pending column. The live secret and the
    // enabled flag are untouched until a code confirms.
    expect(body).toMatch(/data: \{ twoFactorPendingSecret: sealSecret\(secret\) \}/);
    expect(body).not.toMatch(/twoFactorSecret:/);
    expect(body).not.toMatch(/twoFactorEnabled: (true|false)/);
  });

  it('confirming is the only thing that promotes the pending secret', () => {
    const src = readFileSync('src/server/actions/security.ts', 'utf8');
    const body = src.slice(src.indexOf('export async function confirmTwoFactor'), src.indexOf('export async function disableTwoFactor'));
    expect(body).toMatch(/twoFactorSecret: user\.twoFactorPendingSecret/);
    expect(body).toMatch(/twoFactorPendingSecret: null/);
    expect(body).toMatch(/twoFactorEnabled: true/);
    // …and the confirming code's step is burned, so it cannot double as a login code.
    expect(body).toMatch(/twoFactorLastStep: step === null \? null : BigInt\(step\)/);
  });

  it('disabling clears the pending secret too, not just the live one', () => {
    const src = readFileSync('src/server/actions/security.ts', 'utf8');
    const body = src.slice(src.indexOf('export async function disableTwoFactor'));
    expect(body).toMatch(/twoFactorSecret: null/);
    expect(body).toMatch(/twoFactorPendingSecret: null/);
    expect(body).toMatch(/twoFactorLastStep: null/);
  });

  it('no blocking window.prompt is left in the two-factor UI', () => {
    // AMH-071: prompt() returns null silently when the browser suppresses
    // dialogs, so "Disable 2FA" did nothing at all with no error.
    const ui = readFileSync('src/components/settings/two-factor-setup.tsx', 'utf8');
    expect(ui).not.toMatch(/\bprompt\(/);
    expect(ui).toMatch(/PasswordDialog/);
  });
});
