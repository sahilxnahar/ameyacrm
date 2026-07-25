import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/config/env';
import { oauthProvider } from '@/config/oauth-providers';

/**
 * Pure helpers for the generic OAuth2 authorization-code flow. State is signed
 * with the session secret (HMAC) and carries the connector slug + an expiry, so
 * the callback can trust it without a database round-trip and CSRF is prevented.
 */

const STATE_TTL_MS = 10 * 60 * 1000;

export function signState(slug: string, now: number): string {
  const payload = Buffer.from(JSON.stringify({ slug, exp: now + STATE_TTL_MS })).toString('base64url');
  const sig = createHmac('sha256', env.SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyState(state: string, now: number): { slug: string } | null {
  const [payload, sig] = state.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', env.SESSION_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { slug: string; exp: number };
    if (!data.slug || typeof data.exp !== 'number' || data.exp < now) return null;
    return { slug: data.slug };
  } catch { return null; }
}

export function redirectUriFor(origin: string, slug: string): string {
  return `${origin}/api/connectors/oauth/${slug}/callback`;
}

/** Build the provider's authorize URL for a connector. Returns null if unknown. */
export function buildAuthorizeUrl(slug: string, opts: { clientId: string; redirectUri: string; state: string }): string | null {
  const p = oauthProvider(slug);
  if (!p) return null;
  const url = new URL(p.authorizeUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', opts.clientId);
  url.searchParams.set('redirect_uri', opts.redirectUri);
  url.searchParams.set('scope', p.scope);
  url.searchParams.set('state', opts.state);
  for (const [k, v] of Object.entries(p.extraAuthParams ?? {})) url.searchParams.set(k, v);
  return url.toString();
}
