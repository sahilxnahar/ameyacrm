import 'server-only';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { env } from '@/config/env';

/**
 * Read a Gmail mailbox over IMAP (no Google Cloud Console). Auth reuses the SMTP
 * app password unless IMAP_USER/IMAP_PASS are set. Every call opens a short-lived
 * connection, fetches, and logs out — suitable for serverless. Never throws.
 */
export interface InboxItem { uid: number; from: string; fromName: string; subject: string; date: string; seen: boolean }
export interface FullMessage { from: string; to: string; subject: string; date: string; text: string; html: string | null }

function creds(): { user: string; pass: string } | null {
  const user = env.IMAP_USER || env.SMTP_USER;
  const pass = env.IMAP_PASS || env.SMTP_PASS;
  if (!user || !pass) return null;
  return { user, pass };
}

export function imapConfigured(): boolean {
  return creds() !== null;
}

function makeClient(): ImapFlow | null {
  const c = creds();
  if (!c) return null;
  return new ImapFlow({
    host: env.IMAP_HOST,
    port: env.IMAP_PORT,
    secure: true,
    auth: { user: c.user, pass: c.pass },
    logger: false,
  });
}

export async function fetchInbox(limit = 25): Promise<{ items: InboxItem[] } | { error: string }> {
  const client = makeClient();
  if (!client) return { error: 'Gmail isn’t configured. Set IMAP_USER/IMAP_PASS (or reuse SMTP_USER/SMTP_PASS) in Vercel.' };
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const box = client.mailbox;
      const total = box && typeof box === 'object' ? box.exists : 0;
      if (!total) return { items: [] };
      const start = Math.max(1, total - limit + 1);
      const items: InboxItem[] = [];
      for await (const msg of client.fetch(`${start}:*`, { uid: true, envelope: true, flags: true })) {
        const fromAddr = msg.envelope?.from?.[0];
        items.push({
          uid: msg.uid,
          from: fromAddr?.address ?? '',
          fromName: fromAddr?.name ?? '',
          subject: msg.envelope?.subject ?? '(no subject)',
          date: (msg.envelope?.date ?? new Date()).toISOString(),
          seen: msg.flags ? msg.flags.has('\\Seen') : false,
        });
      }
      items.reverse();
      return { items };
    } finally {
      lock.release();
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not reach Gmail over IMAP.' };
  } finally {
    try { await client.logout(); } catch { /* ignore */ }
  }
}

export async function fetchMessage(uid: number): Promise<{ message: FullMessage } | { error: string }> {
  const client = makeClient();
  if (!client) return { error: 'Gmail isn’t configured.' };
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg || !msg.source) return { error: 'That message could not be found.' };
      const parsed = await simpleParser(msg.source);
      const toText = Array.isArray(parsed.to) ? parsed.to.map((a) => a.text).join(', ') : (parsed.to?.text ?? '');
      return {
        message: {
          from: parsed.from?.text ?? '',
          to: toText,
          subject: parsed.subject ?? '(no subject)',
          date: parsed.date ? parsed.date.toISOString() : '',
          text: parsed.text ?? '',
          html: typeof parsed.html === 'string' ? parsed.html : null,
        },
      };
    } finally {
      lock.release();
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not read that message.' };
  } finally {
    try { await client.logout(); } catch { /* ignore */ }
  }
}
