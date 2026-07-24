'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';
import { PROVIDER_BY_KEY } from '@/config/providers';

export type ConnResult = { ok: true; message: string } | { error: string };

/** Forget an external account. Tokens are deleted, not just flagged. */
export async function disconnectProvider(provider: string): Promise<ConnResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    const p = PROVIDER_BY_KEY[provider];
    if (!p) return { error: 'Unknown provider.' };

    await prisma.integrationConnection.updateMany({
      where: { provider },
      data: { status: 'DISCONNECTED', accessToken: null, refreshToken: null, expiresAt: null, lastError: null, connectedAt: null },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Integration', entityId: provider, summary: `Disconnected ${p.name}` });
    revalidatePath('/admin/connections');
    return { ok: true, message: `${p.name} disconnected and its tokens deleted.` };
  } catch (e) {
    return toActionError(e);
  }
}

export type TestResult = { ok: true; message: string } | { error: string };

/**
 * Send a real WhatsApp message to prove the connection works end to end.
 *
 * Deliberately uses plain text: it only succeeds inside the 24-hour window
 * after that number has messaged your business, which is the quickest way to
 * confirm the token and phone number are right without waiting on template
 * approval.
 */
export async function sendWhatsappTest(to: string): Promise<TestResult> {
  try {
    const ctx = await ensure('admin.setting.manage');
    if (!to || to.replace(/\D/g, '').length < 10) return { error: 'Enter the mobile number to test with.' };

    const { sendWhatsappText, getWhatsappConnection, toWaNumber } = await import('@/server/services/whatsapp-service');
    const conn = await getWhatsappConnection();
    if (!conn) return { error: 'WhatsApp is not connected yet.' };
    if (!conn.phoneNumberId) return { error: 'Connected, but no sending number is registered on the WhatsApp Business Account.' };

    const res = await sendWhatsappText(to, 'Test from the Ameya Heights CRM. If you can read this, WhatsApp is working.');
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Integration', entityId: 'whatsapp', summary: `WhatsApp test to ${toWaNumber(to)}: ${res.ok ? 'sent' : 'failed'}` });

    if (!res.ok) {
      const hint = /24|re-?engagement|outside/i.test(res.error)
        ? ' Meta only allows plain text within 24 hours of that number messaging you. Send a WhatsApp to your business number first, then test again.'
        : '';
      return { error: res.error + hint };
    }
    return { ok: true, message: `Sent to ${toWaNumber(to)}. Check that phone.` };
  } catch (e) {
    return toActionError(e);
  }
}
