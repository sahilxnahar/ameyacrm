'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { can } from '@/lib/rbac/can';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';

export type SocResult = { ok: true } | { error: string };

const CHANNELS = ['WHATSAPP', 'LINKEDIN', 'INSTAGRAM', 'FACEBOOK', 'TWITTER', 'YOUTUBE', 'GOOGLE', 'WEBSITE', 'OTHER'] as const;

const schema = z.object({
  userId: z.string().optional(),
  channel: z.enum(CHANNELS),
  handle: z.string().min(1).max(120),
  profileUrl: z.string().max(400).optional().or(z.literal('')),
  displayName: z.string().max(120).optional().or(z.literal('')),
  notes: z.string().max(400).optional().or(z.literal('')),
});

/** Add an account. You may always add your own; adding someone else's needs admin rights. */
export async function addSocialAccount(input: unknown): Promise<SocResult> {
  try {
    const ctx = await ensure('dashboard.view');
    const d = schema.parse(input);
    const userId = d.userId && d.userId !== ctx.user.id ? d.userId : ctx.user.id;
    if (userId !== ctx.user.id && !can(ctx.permissions, 'admin.user.manage')) {
      return { error: 'You can only add your own accounts.' };
    }

    const handle = d.handle.trim().replace(/^@/, '');
    const exists = await prisma.userSocialAccount.findFirst({ where: { userId, channel: d.channel, handle } });
    if (exists) return { error: 'That account is already on the list.' };

    await prisma.userSocialAccount.create({
      data: {
        userId, channel: d.channel, handle,
        profileUrl: d.profileUrl || null,
        displayName: d.displayName || null,
        notes: d.notes || null,
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'User', entityId: userId, summary: `Linked ${d.channel} account ${handle}` });
    revalidatePath('/social-accounts');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function removeSocialAccount(id: string): Promise<SocResult> {
  try {
    const ctx = await ensure('dashboard.view');
    const acc = await prisma.userSocialAccount.findUnique({ where: { id }, select: { userId: true, handle: true, channel: true } });
    if (!acc) return { error: 'Account not found.' };
    if (acc.userId !== ctx.user.id && !can(ctx.permissions, 'admin.user.manage')) {
      return { error: 'You can only remove your own accounts.' };
    }
    await prisma.userSocialAccount.delete({ where: { id } });
    await writeAudit({ actorId: ctx.user.id, action: 'DELETE', entityType: 'User', entityId: acc.userId, summary: `Unlinked ${acc.channel} account ${acc.handle}` });
    revalidatePath('/social-accounts');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function setSocialAccountActive(id: string, isActive: boolean): Promise<SocResult> {
  try {
    const ctx = await ensure('dashboard.view');
    const acc = await prisma.userSocialAccount.findUnique({ where: { id }, select: { userId: true } });
    if (!acc) return { error: 'Account not found.' };
    if (acc.userId !== ctx.user.id && !can(ctx.permissions, 'admin.user.manage')) return { error: 'Not your account.' };
    await prisma.userSocialAccount.update({ where: { id }, data: { isActive } });
    revalidatePath('/social-accounts');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** The number the CRM opens WhatsApp with when this person messages a lead. */
export async function setWhatsappNumber(userId: string, number: string): Promise<SocResult> {
  try {
    const ctx = await ensure('dashboard.view');
    if (userId !== ctx.user.id && !can(ctx.permissions, 'admin.user.manage')) return { error: 'You can only change your own number.' };
    const digits = number.replace(/\D/g, '');
    if (digits && (digits.length < 10 || digits.length > 13)) return { error: 'Enter a 10-digit mobile number, or include the country code.' };
    await prisma.user.update({ where: { id: userId }, data: { whatsappNumber: digits ? (digits.length === 10 ? `91${digits}` : digits) : null } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'User', entityId: userId, summary: 'Updated WhatsApp number' });
    revalidatePath('/social-accounts');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}
