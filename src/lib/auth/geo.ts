import 'server-only';
import { headers } from 'next/headers';

/**
 * Country of the request.
 *
 * Vercel adds this header on every request at no cost, so there is no
 * geolocation service to sign up for and nothing to pay. Returns null when the
 * header is absent — locally, or behind a proxy that strips it — and callers
 * must treat null as "unknown", never as "not allowed".
 */
export async function requestCountry(): Promise<string | null> {
  const h = await headers();
  const c = h.get('x-vercel-ip-country') ?? h.get('cf-ipcountry') ?? null;
  if (!c || c === 'XX' || c.length !== 2) return null;
  return c.toUpperCase();
}

export async function requestCity(): Promise<string | null> {
  const h = await headers();
  const c = h.get('x-vercel-ip-city');
  return c ? decodeURIComponent(c) : null;
}

const NAMES: Record<string, string> = {
  IN: 'India', AE: 'UAE', US: 'United States', GB: 'United Kingdom', SG: 'Singapore',
  AU: 'Australia', CA: 'Canada', SA: 'Saudi Arabia', QA: 'Qatar', OM: 'Oman',
  KW: 'Kuwait', MY: 'Malaysia', DE: 'Germany', FR: 'France', NZ: 'New Zealand',
};

export function countryName(code: string | null): string {
  if (!code) return 'an unknown location';
  return NAMES[code] ?? code;
}
