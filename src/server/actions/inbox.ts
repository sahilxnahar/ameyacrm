'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { sendEmail } from '@/lib/email/email';
import { sendWhatsappText } from '@/server/services/whatsapp-service';
import { randomToken } from '@/lib/utils/crypto';
import { writeAudit } from '@/lib/audit/log';
import { getThread, type InboxChannel, type ThreadMessage } from '@/server/services/inbox-service';
import { ensure, toActionError } from './_helpers';

export type InboxResult = { ok: true } | { error: string };

/** Load one conversation's messages for the reading pane. */
export async function loadInboxThread(channel: InboxChannel, key: string): Promise<{ ok: true; messages: ThreadMessage[] } | { error: string }> {
  try {
    await ensure('lead.view');
    const messages = await getThread(channel, String(key).slice(0, 200));
    return { ok: true, messages };
  } catch (err) { return toActionError(err); }
}

const emailReply = z.object({
  threadKey: z.string().min(1).max(200),
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
});

/** Reply to an email conversation and record the reply in the same thread. */
export async function replyEmailThread(input: unknown): Promise<InboxResult> {
  try {
    const ctx = await ensure('email.send');
    const d = emailReply.parse(input);
    const res = await sendEmail({ to: [d.to], subject: d.subject, text: d.body });
    if (!res.ok) return { error: `Could not send: ${res.error ?? 'email provider not configured'}` };

    // Carry the party links forward from an existing message so the reply stays
    // attached to the right lead / customer / vendor.
    const prior = await prisma.mailThreadMessage.findFirst({
      where: { threadKey: d.threadKey },
      orderBy: { sentAt: 'desc' },
      select: { leadId: true, customerId: true, vendorId: true },
    });

    await prisma.mailThreadMessage.create({
      data: {
        externalId: `out:${randomToken(12)}`,
        threadKey: d.threadKey,
        direction: 'OUTBOUND',
        fromAddress: env.EMAIL_FROM,
        toAddresses: [d.to],
        subject: d.subject,
        bodyText: d.body.slice(0, 8000),
        snippet: d.body.slice(0, 200),
        sentAt: new Date(),
        userId: ctx.user.id,
        leadId: prior?.leadId ?? null,
        customerId: prior?.customerId ?? null,
        vendorId: prior?.vendorId ?? null,
      },
    });

    if (prior?.leadId) {
      await prisma.leadActivity.create({ data: { leadId: prior.leadId, userId: ctx.user.id, type: 'EMAIL', subject: d.subject, notes: d.body.slice(0, 2000) } }).catch(() => undefined);
    }
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'MailThreadMessage', summary: `Replied by email to ${d.to}` });
    revalidatePath('/inbox');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

const emailCompose = z.object({
  to: z.string().email('Enter a valid email address.'),
  subject: z.string().max(300).optional(),
  body: z.string().min(1, 'Write a message.').max(8000),
});

/** Compose and send a brand-new email (not a reply). Sends via SMTP and records it in the inbox. */
export async function composeEmail(input: unknown): Promise<InboxResult> {
  try {
    const ctx = await ensure('email.send');
    const d = emailCompose.parse(input);
    const subject = d.subject?.trim() || '(no subject)';
    const res = await sendEmail({ to: [d.to], subject, text: d.body });
    if (!res.ok) return { error: `Could not send: ${res.error ?? 'email provider not configured'}` };

    await prisma.mailThreadMessage.create({
      data: {
        externalId: `out:${randomToken(12)}`,
        threadKey: `new:${randomToken(10)}`,
        direction: 'OUTBOUND',
        fromAddress: env.EMAIL_FROM,
        toAddresses: [d.to],
        subject,
        bodyText: d.body.slice(0, 8000),
        snippet: d.body.slice(0, 200),
        sentAt: new Date(),
        userId: ctx.user.id,
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'MailThreadMessage', summary: `Composed email to ${d.to}` });
    revalidatePath('/inbox');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

const waReply = z.object({
  phone: z.string().min(6).max(20),
  body: z.string().min(1).max(4000),
});

/** Reply to a WhatsApp conversation and record the outbound message. */
export async function replyWhatsappThread(input: unknown): Promise<InboxResult> {
  try {
    const ctx = await ensure('email.send');
    const d = waReply.parse(input);
    const res = await sendWhatsappText(d.phone, d.body);
    if (!res.ok) return { error: `Could not send: ${res.error}` };

    await prisma.whatsappMessage.create({
      data: {
        externalId: res.id || `out:${randomToken(12)}`,
        phone: d.phone,
        kind: 'text',
        body: d.body.slice(0, 2000),
        handled: true,
        direction: 'OUTBOUND',
        userId: ctx.user.id,
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'WhatsappMessage', summary: `Replied by WhatsApp to ${d.phone}` });
    revalidatePath('/inbox');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}
