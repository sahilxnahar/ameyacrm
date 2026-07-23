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

export type SCBResult = { ok: true; sentTo?: string[]; id?: string } | { error: string };

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
