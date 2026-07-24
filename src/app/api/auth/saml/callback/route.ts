import { NextResponse, type NextRequest } from 'next/server';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { createSession } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';
import { writeAudit } from '@/lib/audit/log';
import { getSamlConfig, buildSaml, emailFromProfile, nameFromProfile } from '@/lib/auth/saml';
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

  await createSession(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), failedLoginCount: 0 } });
  await writeAudit({ actorId: user.id, action: 'LOGIN', summary: 'Signed in with single sign-on' });

  return NextResponse.redirect(`${base()}/dashboard`, 302);
}
