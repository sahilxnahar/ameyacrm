import 'server-only';
import { createSign } from 'crypto';
import { env } from '@/config/env';

export const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive';

export function hasGoogleServiceAccount(): boolean {
  return Boolean(env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_PRIVATE_KEY);
}

function buildJwt(scope: string): string {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL, scope, aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now,
  })}`;
  const key = (env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  return `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(key, 'base64url')}`;
}

/** Exchange the service-account JWT for an OAuth access token. Null on failure. */
export async function getGoogleAccessToken(scope: string = GOOGLE_SCOPES): Promise<string | null> {
  if (!hasGoogleServiceAccount()) return null;
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: buildJwt(scope) }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { access_token?: string };
    return j.access_token ?? null;
  } catch { return null; }
}
