'use server';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { addHours } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { hashPassword } from '@/lib/auth/password';
import { sendEmail } from '@/lib/email/email';
import { notifyMany } from '@/lib/notifications/notify';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';
import type { RoleName } from '@prisma/client';

export type SignupState = { error?: string; ok?: boolean; message?: string };

const DEFAULTS = { domains: ['ameyaheights.com'], role: 'EMPLOYEE' as RoleName };

/** Domains whose members are trusted once they prove they own the mailbox. */
export async function getSignupConfig(): Promise<{ domains: string[]; defaultRole: RoleName; enabled: boolean }> {
  const rows = await prisma.setting.findMany({ where: { key: { in: ['auth.signupDomains', 'auth.signupDefaultRole', 'auth.signupEnabled'] } } });
  const get = (k: string) => rows.find((r) => r.key === k)?.value as unknown;
  const domains = Array.isArray(get('auth.signupDomains')) ? (get('auth.signupDomains') as string[]) : DEFAULTS.domains;
  const defaultRole = (get('auth.signupDefaultRole') as RoleName) || DEFAULTS.role;
  const enabled = get('auth.signupEnabled') === undefined ? true : Boolean(get('auth.signupEnabled'));
  return { domains: domains.map((d) => d.toLowerCase().replace(/^@/, '')), defaultRole, enabled };
}

export async function saveSignupConfig(input: { domains: string; defaultRole: RoleName; enabled: boolean }) {
  try {
    const ctx = await ensure('admin.user.manage');
    const domains = input.domains.split(/[\s,]+/).map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
    await prisma.setting.upsert({ where: { key: 'auth.signupDomains' }, update: { value: domains }, create: { key: 'auth.signupDomains', value: domains } });
    await prisma.setting.upsert({ where: { key: 'auth.signupDefaultRole' }, update: { value: input.defaultRole }, create: { key: 'auth.signupDefaultRole', value: input.defaultRole } });
    await prisma.setting.upsert({ where: { key: 'auth.signupEnabled' }, update: { value: input.enabled }, create: { key: 'auth.signupEnabled', value: input.enabled } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Setting', summary: `Signup config: ${domains.join(', ') || 'none'} -> ${input.defaultRole}` });
    revalidatePath('/admin/access-requests');
    return { ok: true as const };
  } catch (err) { return toActionError(err); }
}

const schema = z.object({
  name: z.string().min(2, 'Please enter your full name'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  note: z.string().max(500).optional(),
});

function baseUrl() { return env.APP_URL.replace(/\/$/, ''); }

/**
 * Anyone may request access. Nobody is trusted on the strength of a typed
 * address alone - a verification link proves they can read that mailbox.
 * Only after that does the domain rule decide: internal goes straight in,
 * everyone else waits for an admin.
 */
export async function signupAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
  try {
    const parsed = schema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
    const { name, password, note } = parsed.data;
    const email = parsed.data.email.trim().toLowerCase();

    const cfg = await getSignupConfig();
    if (!cfg.enabled) return { error: 'Self sign-up is currently switched off. Ask an administrator to invite you.' };

    const existing = await prisma.user.findFirst({ where: { email, deletedAt: null } });
    if (existing) {
      // Never confirm or deny that an address is registered.
      return { ok: true, message: 'Check your email - if this address can be registered, a verification link is on its way.' };
    }

    const domain = email.split('@')[1] ?? '';
    const internal = cfg.domains.includes(domain);
    const token = randomBytes(24).toString('hex');

    // Username must satisfy the existing ^[a-zA-Z0-9_.]+$ rule.
    let username = (email.split('@')[0] ?? '').replace(/[^a-zA-Z0-9_.]/g, '.') || 'user';
    for (let n = 1; await prisma.user.findUnique({ where: { username } }); n++) username = `${username}${n}`;

    await prisma.user.create({
      data: {
        name, email, username,
        passwordHash: await hashPassword(password),
        role: cfg.defaultRole,
        status: 'PENDING',
        signupNote: note || null,
        verifyToken: token,
        verifyExpiresAt: addHours(new Date(), 48),
      },
    });

    const link = `${baseUrl()}/verify/${token}`;
    await sendEmail({
      to: [email],
      subject: 'Confirm your Ameya Heights CRM account',
      text: [
        `Hello ${name},`, '',
        'Please confirm your email address to continue setting up your Ameya Heights CRM account:', '',
        link, '',
        internal
          ? 'Once confirmed, your account is active and you can sign in straight away.'
          : 'Once confirmed, an administrator will review your request and you will hear back by email.',
        '', 'This link expires in 48 hours. If you did not request an account, ignore this message.',
        '', '- Ameya Heights LLP',
      ].join('\n'),
    });

    return { ok: true, message: 'Check your email - if this address can be registered, a verification link is on its way.' };
  } catch (err) {
    const e = toActionError(err);
    return { error: 'error' in e ? e.error : 'Could not create the request.' };
  }
}

export type VerifyOutcome = 'invalid' | 'expired' | 'active' | 'pending_approval' | 'already';

/** Consume a verification token. Called from the public /verify/[token] page. */
export async function verifyEmailToken(token: string): Promise<{ outcome: VerifyOutcome; name?: string }> {
  const user = await prisma.user.findUnique({ where: { verifyToken: token } });
  if (!user) return { outcome: 'invalid' };
  if (user.emailVerifiedAt && user.status === 'ACTIVE') return { outcome: 'already', name: user.name };
  if (user.verifyExpiresAt && user.verifyExpiresAt < new Date()) return { outcome: 'expired', name: user.name };

  const cfg = await getSignupConfig();
  const domain = (user.email.split('@')[1] ?? '').toLowerCase();
  const internal = cfg.domains.includes(domain);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      verifyToken: null,
      verifyExpiresAt: null,
      ...(internal ? { status: 'ACTIVE' as const, approvedAt: new Date() } : {}),
    },
  });

  await writeAudit({ actorId: user.id, action: 'UPDATE', entityType: 'User', entityId: user.id, summary: internal ? `Self-signup activated (${domain})` : `Self-signup verified, awaiting approval (${domain})` });

  if (!internal) {
    const admins = await prisma.user.findMany({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, status: 'ACTIVE', deletedAt: null }, select: { id: true, email: true } });
    await notifyMany(admins.map((a) => a.id), {
      type: 'SYSTEM',
      title: 'Access request awaiting approval',
      body: `${user.name} (${user.email}) has asked to join the CRM.`,
      link: '/admin/access-requests',
    });
    if (admins.length) {
      await sendEmail({
        to: admins.map((a) => a.email),
        subject: `Access request: ${user.name} (${user.email})`,
        text: `${user.name} <${user.email}> has requested access to the Ameya Heights CRM.\n\n${user.signupNote ? `They wrote: "${user.signupNote}"\n\n` : ''}Approve or decline here:\n${baseUrl()}/admin/access-requests\n\n- Ameya Heights CRM`,
      });
    }
  }

  return { outcome: internal ? 'active' : 'pending_approval', name: user.name };
}

export async function approveAccessRequest(id: string, role: RoleName) {
  try {
    const ctx = await ensure('admin.user.manage');
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return { error: 'Request not found.' };
    await prisma.user.update({ where: { id }, data: { status: 'ACTIVE', role, approvedAt: new Date(), approvedById: ctx.user.id } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'User', entityId: id, summary: `Approved access for ${user.email} as ${role}` });
    await sendEmail({
      to: [user.email],
      subject: 'Your Ameya Heights CRM access has been approved',
      text: `Hello ${user.name},\n\nYour access to the Ameya Heights CRM has been approved. You can sign in here:\n${baseUrl()}/login\n\nUse the email address and password you registered with.\n\n- Ameya Heights LLP`,
    });
    revalidatePath('/admin/access-requests');
    return { ok: true as const };
  } catch (err) { return toActionError(err); }
}

export async function declineAccessRequest(id: string, reason?: string) {
  try {
    const ctx = await ensure('admin.user.manage');
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return { error: 'Request not found.' };
    await prisma.user.update({ where: { id }, data: { status: 'DISABLED', deletedAt: new Date() } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'User', entityId: id, summary: `Declined access for ${user.email}` });
    await sendEmail({
      to: [user.email],
      subject: 'Your Ameya Heights CRM access request',
      text: `Hello ${user.name},\n\nYour request for access to the Ameya Heights CRM was not approved at this time.${reason ? `\n\n${reason}` : ''}\n\nIf you believe this is a mistake, please reply to this email.\n\n- Ameya Heights LLP`,
    });
    revalidatePath('/admin/access-requests');
    return { ok: true as const };
  } catch (err) { return toActionError(err); }
}
