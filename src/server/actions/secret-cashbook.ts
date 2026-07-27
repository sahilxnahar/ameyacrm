'use server';
import { randomInt } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { getActionContext, toActionError } from './_helpers';
import { checkRate } from '@/lib/security/rate-limit';
import { sendEmail } from '@/lib/email/email';
import { sendViaOpenWA } from '@/server/services/whatsapp-service';
import { canAccess, issueOtp, checkOtp, issueUnlock, isUnlocked, lock, saveNominees } from '@/lib/secret-cashbook/access';
import { encrypt, decrypt } from '@/lib/utils/crypto';
import { putObject, getObjectStream } from '@/lib/storage/storage';

export type SCBResult = { ok: true; sentTo?: string[]; id?: string } | { error: string };
export type SCBEraseResult = { ok: true; backedUp: number; backupKey: string | null } | { error: string };
export type SCBBackupMeta = { key: string; at: string; count: number };
export type SCBBackupList = { ok: true; backups: SCBBackupMeta[] } | { error: string };
export type SCBRestoreResult = { ok: true; restored: number } | { error: string };

const BACKUP_META_KEY = 'finance.secret_cashbook_backups';

async function gate() {
  const ctx = await getActionContext();
  const allowed = await canAccess(ctx.user.id, ctx.permissions.isSuperAdmin);
  if (!allowed) throw new Error('You are not authorised for the Secret Cash Book.');
  return ctx;
}

/** Send a one-time code to the person's email + WhatsApp. */
export async function requestSecretOtp(): Promise<SCBResult> {
  try {
    const ctx = await gate();
    const rl = await checkRate(`scb:otp:${ctx.user.id}`, 5, 300); // max 5 codes / 5 min
    if (!rl.allowed) return { error: 'Too many code requests. Wait a couple of minutes and try again.' };

    const code = String(randomInt(100000, 1000000));
    await issueOtp(ctx.user.id, code);

    const sentTo: string[] = [];
    const msg = `Ameya Heights — your Secret Cash Book code is ${code}. It expires in 10 minutes. If this wasn't you, ignore it.`;
    if (ctx.user.email) {
      const r = await sendEmail({ to: [ctx.user.email], subject: 'Secret Cash Book — one-time code', text: msg, html: `<p>Your Secret Cash Book code is <b style="font-size:20px">${code}</b>.</p><p>It expires in 10 minutes.</p>` });
      if (r.ok) sentTo.push('email');
    }
    const wa = ctx.user.whatsappNumber || ctx.user.phone;
    if (wa) {
      try { await sendViaOpenWA(wa, msg); sentTo.push('WhatsApp'); } catch { /* WhatsApp is best-effort */ }
    }
    await writeAudit({ actorId: ctx.user.id, action: 'LOGIN', entityType: 'SecretCashBook', summary: 'Requested Secret Cash Book code' });
    if (sentTo.length === 0) return { error: 'No email or WhatsApp number is on your profile to send the code to. Add one under Profile.' };
    return { ok: true, sentTo };
  } catch (e) { return toActionError(e); }
}

/** Verify the code and unlock for this session. */
export async function verifySecretOtp(code: string): Promise<SCBResult> {
  try {
    const ctx = await gate();
    const rl = await checkRate(`scb:verify:${ctx.user.id}`, 8, 300); // throttle guessing
    if (!rl.allowed) return { error: 'Too many attempts. Wait a couple of minutes.' };
    const ok = await checkOtp(ctx.user.id, code);
    if (!ok) return { error: 'That code is wrong or has expired. Send a new one.' };
    await issueUnlock(ctx.user.id);
    await writeAudit({ actorId: ctx.user.id, action: 'LOGIN', entityType: 'SecretCashBook', summary: 'Opened the Secret Cash Book' });
    revalidatePath('/secret-cash-book');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

export async function lockSecretCashBook(): Promise<SCBResult> {
  try {
    await gate();
    await lock();
    revalidatePath('/secret-cash-book');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

async function requireUnlocked() {
  const ctx = await gate();
  if (!(await isUnlocked(ctx.user.id))) throw new Error('The Secret Cash Book is locked. Open it with a code first.');
  return ctx;
}

export async function addSecretEntry(input: {
  entryDate?: string; direction?: string; amount: number | string; party: string;
  mode?: string; reference?: string; note?: string;
}): Promise<SCBResult> {
  try {
    const ctx = await requireUnlocked();
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter an amount above zero.' };
    if (!input.party?.trim()) return { error: 'Who is this with?' };
    const e = await prisma.secretCashEntry.create({
      data: {
        entryDate: input.entryDate ? new Date(input.entryDate) : new Date(),
        direction: input.direction === 'IN' ? 'IN' : 'OUT',
        amount, party: input.party.trim(),
        mode: (input.mode || 'Cash').trim(),
        reference: input.reference?.trim() || null,
        note: input.note?.trim() || null,
        createdById: ctx.user.id,
      },
      select: { id: true },
    });
    // Deliberately no party name in the audit — the point is privacy.
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'SecretCashBook', summary: 'Added a Secret Cash Book entry' });
    revalidatePath('/secret-cash-book');
    return { ok: true, id: e.id };
  } catch (e) { return toActionError(e); }
}

export async function deleteSecretEntry(id: string): Promise<SCBResult> {
  try {
    const ctx = await requireUnlocked();
    await prisma.secretCashEntry.delete({ where: { id } });
    await writeAudit({ actorId: ctx.user.id, action: 'DELETE', entityType: 'SecretCashBook', summary: 'Deleted a Secret Cash Book entry' });
    revalidatePath('/secret-cash-book');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

/** Super Admin only — choose who else may open the Secret Cash Book. */
export async function setSecretNominees(userIds: string[]): Promise<SCBResult> {
  try {
    const ctx = await getActionContext();
    if (!ctx.permissions.isSuperAdmin) return { error: 'Only the owner can change who has access.' };
    await saveNominees([...new Set(userIds.filter(Boolean))]);
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'SecretCashBook', summary: 'Updated Secret Cash Book nominees' });
    revalidatePath('/secret-cash-book');
    return { ok: true };
  } catch (e) { return toActionError(e); }
}

// ── Master erase (owner-only, backup-then-wipe, restorable) ──────────────────

/** The Secret Cash Book must be unlocked AND you must be the owner (Super Admin). */
async function requireOwnerUnlocked() {
  const ctx = await requireUnlocked();
  if (!ctx.permissions.isSuperAdmin) throw new Error('Only the owner (Super Admin) can do this.');
  return ctx;
}

async function listBackupMeta(): Promise<SCBBackupMeta[]> {
  const row = await prisma.setting.findUnique({ where: { key: BACKUP_META_KEY } });
  return Array.isArray(row?.value)
    ? (row!.value as unknown[]).map((b) => {
        const o = b as Record<string, unknown>;
        return { key: String(o.key), at: String(o.at), count: Number(o.count) || 0 };
      })
    : [];
}

/**
 * Wipe the entire Secret Cash Book — but only after safely backing it up.
 *
 * The whole book is exported, encrypted with the app key, and written to backup
 * storage FIRST. Only if that succeeds are the entries deleted. If the backup
 * cannot be written, nothing is erased. Owner-only, and requires the book to be
 * unlocked (the OTP gate). The backup can be restored later, by the owner only.
 */
export async function masterEraseSecretCashBook(): Promise<SCBEraseResult> {
  try {
    const ctx = await requireOwnerUnlocked();
    const entries = await prisma.secretCashEntry.findMany({
      select: { entryDate: true, direction: true, amount: true, party: true, mode: true, reference: true, note: true, createdById: true },
      orderBy: { entryDate: 'asc' },
    });

    let backupKey: string | null = null;
    if (entries.length > 0) {
      const payload = JSON.stringify({
        exportedAt: new Date().toISOString(),
        count: entries.length,
        entries: entries.map((e) => ({
          entryDate: e.entryDate.toISOString(),
          direction: e.direction,
          amount: e.amount.toString(),
          party: e.party,
          mode: e.mode,
          reference: e.reference,
          note: e.note,
          createdById: e.createdById,
        })),
      });
      // Encrypt, then store. If either step throws, we return before deleting.
      const key = `secret-cashbook-backups/scb-${Date.now()}.enc`;
      await putObject(key, Buffer.from(encrypt(payload), 'utf8'), 'text/plain');
      backupKey = key;
      const meta = await listBackupMeta();
      meta.unshift({ key, at: new Date().toISOString(), count: entries.length });
      await prisma.setting.upsert({ where: { key: BACKUP_META_KEY }, create: { key: BACKUP_META_KEY, value: meta.slice(0, 50) }, update: { value: meta.slice(0, 50) } });
    }

    await prisma.secretCashEntry.deleteMany({});
    await writeAudit({ actorId: ctx.user.id, action: 'DELETE', entityType: 'SecretCashBook', summary: `Master erase — ${entries.length} entries backed up then cleared` });
    revalidatePath('/secret-cash-book');
    return { ok: true, backedUp: entries.length, backupKey };
  } catch (e) {
    return toActionError(e);
  }
}

/** The owner's list of Secret Cash Book backups, newest first. */
export async function listSecretCashBackups(): Promise<SCBBackupList> {
  try {
    await requireOwnerUnlocked();
    return { ok: true, backups: await listBackupMeta() };
  } catch (e) {
    return toActionError(e);
  }
}

/** Restore a backup — re-inserts its entries. Owner-only; the key must be a known backup. */
export async function restoreSecretCashBackup(key: string): Promise<SCBRestoreResult> {
  try {
    const ctx = await requireOwnerUnlocked();
    const meta = await listBackupMeta();
    if (!meta.some((b) => b.key === key)) return { error: 'That backup is not recognised.' };

    const { body } = await getObjectStream(key);
    const parsed = JSON.parse(decrypt(body.toString('utf8'))) as {
      entries?: Array<{ entryDate: string; direction: string; amount: string; party: string; mode: string; reference: string | null; note: string | null; createdById: string | null }>;
    };
    const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
    if (entries.length === 0) return { error: 'That backup is empty.' };

    await prisma.secretCashEntry.createMany({
      data: entries.map((e) => ({
        entryDate: new Date(e.entryDate),
        direction: e.direction === 'IN' ? 'IN' : 'OUT',
        amount: e.amount,
        party: e.party,
        mode: e.mode || 'Cash',
        reference: e.reference ?? null,
        note: e.note ?? null,
        createdById: e.createdById ?? ctx.user.id,
      })),
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'SecretCashBook', summary: `Restored ${entries.length} entries from a backup` });
    revalidatePath('/secret-cash-book');
    return { ok: true, restored: entries.length };
  } catch (e) {
    return toActionError(e);
  }
}
