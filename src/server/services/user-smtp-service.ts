import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { decryptSafe } from '@/lib/utils/crypto';

/**
 * Resolve which mailbox a given user SENDS from. This is the outbound twin of
 * resolveUserImap(): the CRM sends mail AS the signed-in user when they have a
 * personal inbox configured, instead of always falling back to the shared
 * org/no-reply sender (the "everything goes out as hi@" bug).
 *
 * The SMTP credential reuses the user's stored IMAP app password (imapPassEnc) —
 * for Gmail (and most providers) the same app password authenticates both IMAP
 * and SMTP, so the user configures it once. The SMTP host is derived from their
 * IMAP host (imap.gmail.com -> smtp.gmail.com) unless they override it.
 */
export interface UserSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  /** RFC5322 From header, e.g. `Asha Rao <asha@ameyaheights.com>`. */
  from: string;
}

/** imap.gmail.com -> smtp.gmail.com; imap.example.com -> smtp.example.com. */
function deriveSmtpHost(imapHost: string | null | undefined): string {
  const h = (imapHost || env.IMAP_HOST || 'imap.gmail.com').trim();
  return h.replace(/^imap\./i, 'smtp.');
}

export async function resolveUserSmtp(
  userId: string,
): Promise<{ config: UserSmtpConfig | null; source: 'user' | 'org' | 'none' }> {
  try {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true, email: true, sendAsSelf: true,
        imapHost: true, imapUser: true, imapPassEnc: true,
        smtpHost: true, smtpPort: true, smtpSecure: true,
      },
    });

    if (u && u.sendAsSelf && u.imapUser && u.imapPassEnc) {
      const pass = decryptSafe(u.imapPassEnc);
      if (pass) {
        const host = (u.smtpHost && u.smtpHost.trim()) || deriveSmtpHost(u.imapHost);
        const port = u.smtpPort && u.smtpPort > 0 ? u.smtpPort : 465;
        const secure = u.smtpSecure ?? port === 465;
        const address = u.email;
        const from = u.name ? `${u.name} <${address}>` : address;
        return { config: { host, port, secure, user: u.imapUser, pass, from }, source: 'user' };
      }
    }
  } catch {
    /* fall through to org */
  }

  // Org fallback — the shared mailbox, used for system mail and for users who
  // haven't connected their own inbox (or opted out via sendAsSelf=false).
  if (env.SMTP_USER && env.SMTP_PASS) {
    return {
      config: {
        host: env.SMTP_HOST || deriveSmtpHost(env.IMAP_HOST),
        port: env.SMTP_PORT || 465,
        secure: env.SMTP_SECURE,
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
        from: env.EMAIL_FROM,
      },
      source: 'org',
    };
  }
  return { config: null, source: 'none' };
}

export interface UserSmtpStatus {
  sendsAsSelf: boolean;
  source: 'user' | 'org' | 'none';
  fromAddress: string | null;
  host: string | null;
  port: number | null;
}

/** For the Email Settings screen: shows the user exactly what address their sent mail leaves as. */
export async function getUserSmtpStatus(userId: string): Promise<UserSmtpStatus> {
  const u = await prisma.user
    .findUnique({
      where: { id: userId },
      select: {
        email: true, sendAsSelf: true, imapUser: true, imapPassEnc: true,
        imapHost: true, smtpHost: true, smtpPort: true,
      },
    })
    .catch(() => null);

  if (u && u.sendAsSelf && u.imapUser && u.imapPassEnc) {
    const host = (u.smtpHost && u.smtpHost.trim()) || deriveSmtpHost(u.imapHost);
    const port = u.smtpPort && u.smtpPort > 0 ? u.smtpPort : 465;
    return { sendsAsSelf: true, source: 'user', fromAddress: u.email, host, port };
  }
  if (env.SMTP_USER && env.SMTP_PASS) {
    return {
      sendsAsSelf: false, source: 'org', fromAddress: env.EMAIL_FROM,
      host: env.SMTP_HOST || deriveSmtpHost(env.IMAP_HOST), port: env.SMTP_PORT || 465,
    };
  }
  return { sendsAsSelf: false, source: 'none', fromAddress: null, host: null, port: null };
}
