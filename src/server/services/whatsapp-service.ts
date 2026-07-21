import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { decrypt } from '@/lib/utils/crypto';
import { tokensIn, render } from '@/lib/templates/engine';

const GRAPH = 'https://graph.facebook.com/v21.0';

export interface WaConnection {
  token: string;
  wabaId: string | null;
  phoneNumberId: string | null;
  displayNumber: string | null;
}

/** The stored WhatsApp connection, decrypted. Null when not connected. */
export async function getWhatsappConnection(): Promise<WaConnection | null> {
  // A pasted System User token wins. It never expires, needs no App Review,
  // and is the quickest way to get a single business sending.
  if (env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID) {
    return {
      token: env.WHATSAPP_TOKEN,
      wabaId: env.WHATSAPP_WABA_ID ?? null,
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
      displayNumber: null,
    };
  }

  const c = await prisma.integrationConnection.findUnique({ where: { provider: 'whatsapp' } });
  if (!c || c.status !== 'CONNECTED' || !c.accessToken) return null;
  const meta = (c.meta ?? {}) as { wabaId?: string; phoneNumberId?: string; displayNumber?: string };
  try {
    return {
      token: decrypt(c.accessToken),
      wabaId: meta.wabaId ?? null,
      phoneNumberId: meta.phoneNumberId ?? null,
      displayNumber: meta.displayNumber ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Find the business account and the number messages will be sent from.
 *
 * The OAuth token alone is not enough to send anything: the Cloud API needs a
 * phone number ID, which has to be looked up after the person authorises.
 */
export async function discoverWabaDetails(token: string): Promise<{ wabaId: string | null; phoneNumberId: string | null; displayNumber: string | null; businessName: string | null; error: string | null }> {
  const empty = { wabaId: null, phoneNumberId: null, displayNumber: null, businessName: null };
  try {
    const bizRes = await fetch(`${GRAPH}/me/businesses?fields=id,name&access_token=${encodeURIComponent(token)}`);
    if (!bizRes.ok) return { ...empty, error: `Could not read your Meta businesses (HTTP ${bizRes.status}).` };
    const biz = (await bizRes.json()) as { data?: Array<{ id: string; name: string }> };
    const business = biz.data?.[0];
    if (!business) return { ...empty, error: 'That account is not an admin of any Meta Business.' };

    const wabaRes = await fetch(`${GRAPH}/${business.id}/owned_whatsapp_business_accounts?access_token=${encodeURIComponent(token)}`);
    const waba = wabaRes.ok ? ((await wabaRes.json()) as { data?: Array<{ id: string }> }) : { data: [] };
    const wabaId = waba.data?.[0]?.id ?? null;
    if (!wabaId) {
      return { ...empty, businessName: business.name, error: 'No WhatsApp Business Account is attached to that Meta Business yet. Add WhatsApp in Meta Business Manager first.' };
    }

    const numRes = await fetch(`${GRAPH}/${wabaId}/phone_numbers?access_token=${encodeURIComponent(token)}`);
    const nums = numRes.ok ? ((await numRes.json()) as { data?: Array<{ id: string; display_phone_number: string }> }) : { data: [] };
    const first = nums.data?.[0];
    if (!first) {
      return { wabaId, phoneNumberId: null, displayNumber: null, businessName: business.name, error: 'No phone number is registered to that WhatsApp Business Account yet.' };
    }
    return { wabaId, phoneNumberId: first.id, displayNumber: first.display_phone_number, businessName: business.name, error: null };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : 'Lookup failed.' };
  }
}

/** Indian numbers get typed a dozen ways. Normalise to what Meta expects. */
export function toWaNumber(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `91${digits}`;            // plain mobile
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(1);
  if (digits.length >= 11 && digits.length <= 15) return digits; // already international
  return null;
}

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Send an approved template.
 *
 * Meta only allows a free-form message within 24 hours of the person writing
 * to you. Everything the CRM sends first — reminders, receipts — must be a
 * template Meta has approved, with values passed positionally.
 */
export async function sendWhatsappTemplate(
  to: string,
  templateKey: string,
  values: Record<string, string>,
): Promise<SendResult> {
  const conn = await getWhatsappConnection();
  if (!conn) return { ok: false, error: 'WhatsApp is not connected. Admin > Connected Accounts.' };
  if (!conn.phoneNumberId) return { ok: false, error: 'No sending number is registered on the WhatsApp account yet.' };

  const number = toWaNumber(to);
  if (!number) return { ok: false, error: `"${to}" is not a phone number WhatsApp will accept.` };

  const tpl = await prisma.messageTemplate.findUnique({ where: { key: templateKey } });
  if (!tpl) return { ok: false, error: `No template named "${templateKey}".` };
  if (tpl.channel !== 'WHATSAPP') return { ok: false, error: `"${templateKey}" is not a WhatsApp template.` };
  if (tpl.metaStatus !== 'APPROVED') {
    return { ok: false, error: `"${tpl.name}" is ${tpl.metaStatus === 'PENDING' ? 'still being reviewed by Meta' : 'not approved by Meta yet'}, so it cannot be sent.` };
  }

  // Values must go in the same order the template declares them.
  const order = tokensIn(tpl.body);
  const parameters = order.map((token) => ({ type: 'text', text: values[token] ?? '' }));

  const body = {
    messaging_product: 'whatsapp',
    to: number,
    type: 'template',
    template: {
      name: tpl.key,
      language: { code: tpl.language || 'en' },
      components: parameters.length ? [{ type: 'body', parameters }] : [],
    },
  };

  try {
    const res = await fetch(`${GRAPH}/${conn.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${conn.token}` },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `Meta refused it (HTTP ${res.status}): ${text.slice(0, 200)}` };
    const out = JSON.parse(text) as { messages?: Array<{ id: string }> };
    await prisma.messageTemplate.update({
      where: { id: tpl.id },
      data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
    }).catch(() => undefined);
    return { ok: true, id: out.messages?.[0]?.id ?? 'sent' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Send failed.' };
  }
}

/**
 * Send plain text. Only works inside the 24-hour window after the person
 * messaged you — outside it Meta rejects the send, which is why reminders use
 * templates instead.
 */
export async function sendWhatsappText(to: string, message: string): Promise<SendResult> {
  const conn = await getWhatsappConnection();
  if (!conn) return { ok: false, error: 'WhatsApp is not connected.' };
  if (!conn.phoneNumberId) return { ok: false, error: 'No sending number registered.' };
  const number = toWaNumber(to);
  if (!number) return { ok: false, error: `"${to}" is not a usable phone number.` };

  try {
    const res = await fetch(`${GRAPH}/${conn.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${conn.token}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: number, type: 'text', text: { body: message.slice(0, 4000) } }),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `Meta refused it (HTTP ${res.status}): ${text.slice(0, 200)}` };
    const out = JSON.parse(text) as { messages?: Array<{ id: string }> };
    return { ok: true, id: out.messages?.[0]?.id ?? 'sent' };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Send failed.' };
  }
}

export { render };
