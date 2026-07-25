import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyRazorpaySignature, extractRazorpayPayment } from '@/lib/connectors/razorpay';

describe('razorpay connector (v15.30)', () => {
  const secret = 'whsec_test_123';
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', amount: 1200000, currency: 'INR', status: 'captured', notes: { bookingId: 'bk_1' } } } } });

  it('accepts a correctly signed webhook', () => {
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyRazorpaySignature(body, sig, secret)).toBe(true);
  });

  it('rejects a tampered body or wrong secret', () => {
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyRazorpaySignature(body + 'x', sig, secret)).toBe(false);
    expect(verifyRazorpaySignature(body, sig, 'wrong')).toBe(false);
    expect(verifyRazorpaySignature(body, '', secret)).toBe(false);
  });

  it('extracts the payment entity and its notes', () => {
    const p = extractRazorpayPayment(JSON.parse(body));
    expect(p?.id).toBe('pay_1');
    expect(p?.amount).toBe(1200000); // paise
    expect(p?.notes?.bookingId).toBe('bk_1');
  });

  it('returns null when there is no payment entity', () => {
    expect(extractRazorpayPayment({ event: 'x' })).toBeNull();
  });
});
