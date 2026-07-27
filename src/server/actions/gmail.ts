'use server';
import { ensure, toActionError } from './_helpers';
import { fetchInbox, fetchMessage, imapConfigured, type InboxItem, type FullMessage } from '@/lib/mail/imap';
import { sendEmail } from '@/lib/email/email';
import { writeAudit } from '@/lib/audit/log';

export type GmailInboxResult = { ok: true; configured: boolean; items: InboxItem[] } | { error: string };
export type GmailMessageResult = { ok: true; message: FullMessage } | { error: string };
export type GmailSendResult = { ok: true } | { error: string };

/** Load the most recent inbox messages over IMAP. */
export async function loadGmailInbox(): Promise<GmailInboxResult> {
  try {
    await ensure('email.send');
    if (!imapConfigured()) return { ok: true, configured: false, items: [] };
    const r = await fetchInbox(25);
    if ('error' in r) return { error: r.error };
    return { ok: true, configured: true, items: r.items };
  } catch (e) {
    return toActionError(e);
  }
}

/** Read one message's full body. */
export async function readGmailMessage(uid: number): Promise<GmailMessageResult> {
  try {
    await ensure('email.send');
    const r = await fetchMessage(uid);
    if ('error' in r) return { error: r.error };
    return { ok: true, message: r.message };
  } catch (e) {
    return toActionError(e);
  }
}

/** Send an email via SMTP (reply or new). */
export async function sendGmail(input: { to: string; subject?: string; body: string }): Promise<GmailSendResult> {
  try {
    const ctx = await ensure('email.send');
    const to = (input.to || '').trim();
    if (!to) return { error: 'Enter a recipient email.' };
    if (!input.body?.trim()) return { error: 'Write a message.' };
    const res = await sendEmail({ to: [to], subject: input.subject?.trim() || '(no subject)', text: input.body });
    if (!res.ok) return { error: `Could not send: ${res.error ?? 'email provider not configured'}` };
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Email', summary: `Sent email to ${to}` });
    return { ok: true };
  } catch (e) {
    return toActionError(e);
  }
}
