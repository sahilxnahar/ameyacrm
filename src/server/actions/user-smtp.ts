'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { sendEmail } from '@/lib/email/email';
import { resolveUserSmtp } from '@/server/services/user-smtp-service';
import { getActionContext, toActionError } from './_helpers';

export interface MyOutboundInput {
  sendAsSelf: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
}

/**
 * Save the signed-in user's OUTBOUND preferences. The sending credential itself is
 * the IMAP app password they already stored on the Email Integration screen — this
 * only toggles "send as me" and optionally overrides the derived SMTP endpoint.
 */
export async function saveMyOutbound(input: MyOutboundInput): Promise<{ ok: true } | { error: string }> {
  try {
    const ctx = await getActionContext();
    const smtpHost = input.smtpHost?.trim() || null;
    const smtpPort = Number.isFinite(input.smtpPort) && (input.smtpPort ?? 0) > 0 ? Math.trunc(input.smtpPort as number) : null;
    const smtpSecure = typeof input.smtpSecure === 'boolean' ? input.smtpSecure : null;

    await prisma.user.update({
      where: { id: ctx.user.id },
      data: { sendAsSelf: !!input.sendAsSelf, smtpHost, smtpPort, smtpSecure },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'User', entityId: ctx.user.id, summary: `Outbound email set to ${input.sendAsSelf ? 'send as self' : 'shared org sender'}` });
    revalidatePath('/email-settings');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Send a real test email to the user's own address, as themselves, so they can confirm the From line. */
export async function sendMyTestEmail(): Promise<{ ok: true; from: string } | { error: string }> {
  try {
    const ctx = await getActionContext();
    const { config, source } = await resolveUserSmtp(ctx.user.id);
    if (!config) return { error: 'No mailbox is configured. Connect your inbox first.' };
    if (source !== 'user') return { error: 'You are on the shared org sender. Turn on "Send as me" and connect your inbox to send as yourself.' };
    const res = await sendEmail(
      {
        to: [ctx.user.email],
        subject: 'Ameya OS — outbound email test',
        text: `This is a test from Ameya OS.\n\nIf you received this, your outbound email is correctly sending as ${config.from}.`,
      },
      { asUserId: ctx.user.id },
    );
    if (!res.ok) return { error: res.error ?? 'Send failed.' };
    return { ok: true, from: config.from };
  } catch (err) { return toActionError(err); }
}
