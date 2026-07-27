import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verify a Razorpay webhook signature: HMAC-SHA256(rawBody, webhookSecret) in hex,
 * compared to the `x-razorpay-signature` header in constant time. Pure + testable.
 */
export function verifyRazorpaySignature(rawBody: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface RazorpayPayment {
  id: string;
  amount: number;      // in paise
  currency: string;
  status: string;
  email?: string;
  contact?: string;
  notes?: Record<string, string>;
}

/** Pull the payment entity out of a Razorpay webhook body, if present. */
export function extractRazorpayPayment(body: Record<string, unknown>): RazorpayPayment | null {
  const entity = (body?.payload as Record<string, unknown> | undefined)?.payment as Record<string, unknown> | undefined;
  const p = entity?.entity as Record<string, unknown> | undefined;
  if (!p || !p.id) return null;
  return {
    id: String(p.id),
    amount: Number(p.amount ?? 0),
    currency: String(p.currency ?? 'INR'),
    status: String(p.status ?? ''),
    email: p.email ? String(p.email) : undefined,
    contact: p.contact ? String(p.contact) : undefined,
    notes: (p.notes as Record<string, string> | undefined) ?? {},
  };
}
