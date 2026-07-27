'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { encrypt } from '@/lib/utils/crypto';
import { writeAudit } from '@/lib/audit/log';
import { testImapConnection } from '@/lib/mail/imap';
import { resolveUserImap } from '@/server/services/user-imap-service';
import { getActionContext, toActionError } from './_helpers';

export interface MyImapInput { host: string; port: number; user: string; pass?: string }

/** Save (and verify) the signed-in user's own IMAP inbox settings. */
export async function saveMyImap(input: MyImapInput): Promise<{ ok: true } | { error: string }> {
  try {
    const ctx = await getActionContext();
    const host = (input.host || 'imap.gmail.com').trim();
    const port = Number.isFinite(input.port) && input.port > 0 ? Math.trunc(input.port) : 993;
    const user = (input.user || '').trim();
    if (!user) return { error: 'Email / IMAP username is required.' };

    // If no new password is supplied, keep the existing one.
    let passToUse = input.pass?.trim() || '';
    if (!passToUse) {
      const existing = await prisma.user.findUnique({ where: { id: ctx.user.id }, select: { imapPassEnc: true } });
      if (!existing?.imapPassEnc) return { error: 'A password / app-password is required the first time.' };
      // Verify with the stored (decrypted) password via resolve.
      const resolved = await resolveUserImap(ctx.user.id);
      const test = resolved.config ? await testImapConnection({ ...resolved.config, host, port, user }) : { error: 'No stored password.' };
      if ('error' in test) return { error: `Could not connect: ${test.error}` };
      await prisma.user.update({ where: { id: ctx.user.id }, data: { imapHost: host, imapPort: port, imapUser: user } });
      revalidatePath('/email-settings');
      return { ok: true };
    }

    // Verify the new credentials before storing them.
    const test = await testImapConnection({ host, port, user, pass: passToUse });
    if ('error' in test) return { error: `Could not connect: ${test.error}` };
    await prisma.user.update({ where: { id: ctx.user.id }, data: { imapHost: host, imapPort: port, imapUser: user, imapPassEnc: encrypt(passToUse) } });
    await writeAudit({ action: 'UPDATE', entityType: 'User', entityId: ctx.user.id, summary: 'Configured personal IMAP inbox' });
    revalidatePath('/email-settings');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Test the currently-saved connection for the signed-in user. */
export async function testMyImap(): Promise<{ ok: true; source: string } | { error: string }> {
  try {
    const ctx = await getActionContext();
    const { config, source } = await resolveUserImap(ctx.user.id);
    if (!config) return { error: 'No mailbox configured yet.' };
    const test = await testImapConnection(config);
    if ('error' in test) return { error: test.error };
    return { ok: true, source };
  } catch (err) { return toActionError(err); }
}

export async function clearMyImap(): Promise<{ ok: true } | { error: string }> {
  try {
    const ctx = await getActionContext();
    await prisma.user.update({ where: { id: ctx.user.id }, data: { imapHost: null, imapPort: null, imapUser: null, imapPassEnc: null } });
    revalidatePath('/email-settings');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}
