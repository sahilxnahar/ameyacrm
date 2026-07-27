import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { decryptSafe } from '@/lib/utils/crypto';
import type { ImapConfig } from '@/lib/mail/imap';

/**
 * Resolve which mailbox a given user reads. Their own IMAP settings win; if they
 * haven't configured one, we fall back to the org-wide env mailbox — so nothing
 * breaks for existing users while each person can now connect their own inbox.
 */
export async function resolveUserImap(userId: string): Promise<{ config: ImapConfig | null; source: 'user' | 'org' | 'none' }> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { imapHost: true, imapPort: true, imapUser: true, imapPassEnc: true } });
    if (u?.imapUser && u.imapPassEnc) {
      const pass = decryptSafe(u.imapPassEnc);
      if (pass) {
        return { config: { host: u.imapHost || env.IMAP_HOST, port: u.imapPort || env.IMAP_PORT, user: u.imapUser, pass }, source: 'user' };
      }
    }
  } catch { /* fall through to org */ }
  const envUser = env.IMAP_USER || env.SMTP_USER;
  const envPass = env.IMAP_PASS || env.SMTP_PASS;
  if (envUser && envPass) return { config: { host: env.IMAP_HOST, port: env.IMAP_PORT, user: envUser, pass: envPass }, source: 'org' };
  return { config: null, source: 'none' };
}

export interface UserImapStatus { configured: boolean; source: 'user' | 'org' | 'none'; host: string | null; port: number | null; user: string | null }

export async function getUserImapStatus(userId: string): Promise<UserImapStatus> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { imapHost: true, imapPort: true, imapUser: true, imapPassEnc: true } }).catch(() => null);
  if (u?.imapUser && u.imapPassEnc) {
    return { configured: true, source: 'user', host: u.imapHost ?? env.IMAP_HOST, port: u.imapPort ?? env.IMAP_PORT, user: u.imapUser };
  }
  const orgUser = env.IMAP_USER || env.SMTP_USER;
  if (orgUser) return { configured: true, source: 'org', host: env.IMAP_HOST, port: env.IMAP_PORT, user: orgUser };
  return { configured: false, source: 'none', host: null, port: null, user: null };
}
