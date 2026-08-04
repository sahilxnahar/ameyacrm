import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { createSession, getClientInfo } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';
import { writeAudit } from '@/lib/audit/log';
import { getSamlConfig, buildSaml, emailFromProfile, nameFromProfile } from '@/lib/auth/saml';
import { getSecurityPolicy, countryAllowed } from '@/lib/auth/policy';
import { requestCountry, requestCity, countryName } from '@/lib/auth/geo';
import { isKnownDevice, beginDeviceApproval, alertNewSignIn } from '@/lib/auth/device';
import { issueMfaTicket } from '@/lib/auth/mfa-ticket';
import type { RoleName } from '@prisma/client';

export const dynamic = 'force-dynamic';

const base = () => env.APP_URL.replace(/\/$/, '');
const fail = (msg: string) => NextResponse.redirect(`${base()}/login?sso=${encodeURIComponent(msg)}`, 302);

/**
 * Where the identity provider sends the signed assertion.
 *
 * Every rejection path is deliberately vague to the browser and specific in the
 * audit log — an unauthenticated visitor should not learn which addresses exist.
 */
export async function POST(req: NextRequest) {
  const cfg = await getSamlConfig();
  const built = await buildSaml(cfg);
  if (!built.ok) return fail(built.error);

  let profile: Record<string, unknown> | null = null;
  try {
    const form = await req.formData();
    const body: Record<string, string> = {};
    form.forEach((v, k) => { body[k] = String(v); });
    const saml = built.saml as { validatePostResponseAsync: (b: Record<string, string>) => Promise<{ profile: Record<string, unknown> | null }> };
    const result = await saml.validatePostResponseAsync(body);
    profile = result.profile;
  } catch (err) {
    await writeAudit({ action: 'LOGIN_FAILED', summary: `SSO assertion rejected: ${err instanceof Error ? err.message : 'invalid'}` }).catch(() => undefined);
    return fail('Single sign-on could not be verified.');
  }

  const email = emailFromProfile(profile);
  if (!email) return fail('The identity provider did not send an email address.');

  const domain = email.split('@')[1] ?? '';
  if (cfg.allowedDomains.length && !cfg.allowedDomains.map((d) => d.toLowerCase()).includes(domain)) {
    await writeAudit({ action: 'LOGIN_FAILED', summary: `SSO refused for ${email} — domain not allowed` }).catch(() => undefined);
    return fail('That account is not allowed to sign in here.');
  }

  let user = await prisma.user.findFirst({ where: { email, deletedAt: null } });

  if (!user) {
    if (!cfg.autoProvision) {
      await writeAudit({ action: 'LOGIN_FAILED', summary: `SSO refused for ${email} — no account and auto-provisioning is off` }).catch(() => undefined);
      return fail('You do not have an account here yet. Ask an administrator.');
    }
    let username = (email.split('@')[0] ?? '').replace(/[^a-zA-Z0-9_.]/g, '.') || 'user';
    for (let n = 1; await prisma.user.findUnique({ where: { username } }); n++) username = `${username}${n}`;
    user = await prisma.user.create({
      data: {
        name: nameFromProfile(profile, email.split('@')[0] ?? email),
        email, username,
        // No password is ever used for this account; a random one keeps the
        // column honest rather than leaving a guessable blank.
        passwordHash: await hashPassword(randomBytes(24).toString('hex')),
        role: (cfg.defaultRole as RoleName) ?? 'EMPLOYEE',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        approvedAt: new Date(),
      },
    });
    await writeAudit({ actorId: user.id, action: 'CREATE', entityType: 'User', entityId: user.id, summary: `Account created by single sign-on (${email})` });
  }

  if (user.status !== 'ACTIVE') {
    await writeAudit({ actorId: user.id, action: 'LOGIN_FAILED', summary: `SSO blocked — account is ${user.status}` }).catch(() => undefined);
    return fail('This account is not active. Contact your administrator.');
  }

  /*
   * ── AMH-043 ────────────────────────────────────────────────────────────────
   *
   * This used to be `await createSession(user.id)` and nothing else.
   *
   * The password path (server/actions/auth.ts) reads the security policy and
   * refuses a sign-in from a disallowed country, refuses an unapproved device,
   * routes through two-factor, and emails an alert on a new device. None of
   * that ran here — so single sign-on was a complete bypass of every login
   * control the organisation had configured. Anyone who could complete an
   * assertion was straight in, from anywhere, on any device, with no second
   * factor, regardless of what the admin had switched on.
   *
   * The gates below are the same ones, in the same order, so the two paths
   * cannot drift apart again without a test noticing.
   *
   * An organisation that genuinely wants SSO to stand alone can turn the
   * relevant switches off in Admin → Security policy. That is a visible,
   * audited decision; a silent exemption for one route is not.
   */
  const policy = await getSecurityPolicy();
  const country = await requestCountry();

  // Where from. An unknown country is never treated as a refusal.
  if (!countryAllowed(country, user, policy)) {
    await writeAudit({
      actorId: user.id, action: 'LOGIN_FAILED',
      summary: `SSO refused — sign-in from ${countryName(country)}, outside the allowed countries`,
    }).catch(() => undefined);
    return fail(`Sign-in from ${countryName(country)} is not permitted. Ask an administrator.`);
  }

  // A device nobody has approved does not get a session, assertion or not.
  const known = await isKnownDevice(user.id);
  if (policy.deviceApproval && !known) {
    const approval = await beginDeviceApproval(user);
    await writeAudit({
      actorId: user.id, action: 'LOGIN_FAILED',
      summary: approval.emailed
        ? `SSO device approval required — code emailed (${countryName(country)})`
        : `SSO device approval required but the email FAILED to send: ${approval.error}`,
    }).catch(() => undefined);
    return NextResponse.redirect(
      `${base()}/device-check?t=${approval.token}${approval.emailed ? '' : '&sendfailed=1'}`, 302,
    );
  }

  /*
   * Second factor. Only when the account actually has one enrolled — an
   * assertion cannot enrol one, and bouncing a user to a TOTP screen they have
   * no secret for would lock them out of a working account.
   *
   * `issueMfaTicket` grants a short-lived ticket, NOT a session, so nothing is
   * signed in until the code is entered.
   */
  if (user.twoFactorEnabled && user.twoFactorSecret) {
    await issueMfaTicket(user.id);
    await writeAudit({ actorId: user.id, action: 'LOGIN', summary: 'SSO verified — awaiting second factor' }).catch(() => undefined);
    return NextResponse.redirect(`${base()}/two-factor`, 302);
  }

  await createSession(user.id);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedLoginCount: 0, lastCountry: country ?? undefined },
  }).catch(() => undefined);
  await writeAudit({ actorId: user.id, action: 'LOGIN', summary: `Signed in with single sign-on from ${countryName(country)}` });

  if (policy.alertNewDevice && !known) {
    const info = await getClientInfo();
    await alertNewSignIn(user, { country, city: await requestCity(), ip: info.ip, ua: info.userAgent }).catch(() => undefined);
  }

  // Guests belong on the sealed preview, never the workspace home.
  if (user.role === 'GUEST') return NextResponse.redirect(`${base()}/demo`, 302);
  return NextResponse.redirect(`${base()}/home`, 302);
}
