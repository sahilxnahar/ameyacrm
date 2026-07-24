// Client-safe consent catalogue (no server-only imports).

export const CONSENT_PURPOSES = [
  { key: 'MARKETING', label: 'Marketing & offers', blurb: 'Emails and messages about projects, offers and events.' },
  { key: 'WHATSAPP', label: 'WhatsApp updates', blurb: 'Booking, payment and project updates over WhatsApp.' },
  { key: 'CALLS', label: 'Phone calls', blurb: 'Sales and service calls from our team.' },
  { key: 'DATA_PROCESSING', label: 'Data processing', blurb: 'Storing and using KYC/booking data to serve this customer.' },
] as const;

export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number]['key'];
export const CONSENT_PURPOSE_KEYS = CONSENT_PURPOSES.map((p) => p.key) as readonly string[];
export type ConsentStatus = 'GIVEN' | 'WITHDRAWN';

/** Reduce an append-only trail to the current state per purpose (latest wins). */
export function currentConsent(
  rows: Array<{ purpose: string; status: string; createdAt: string | Date }>,
): Record<string, { status: string; at: string }> {
  const out: Record<string, { status: string; at: string }> = {};
  const sorted = [...rows].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  for (const r of sorted) out[r.purpose] = { status: r.status, at: new Date(r.createdAt).toISOString() };
  return out;
}
