import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { PROVIDER_BY_KEY } from '@/config/providers';
import { randomToken } from '@/lib/utils/crypto';

export const dynamic = 'force-dynamic';

/** Step 1 of the login: send the person to the vendor with a signed state value. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!can(ctx.permissions, 'admin.setting.manage')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { provider } = await params;
  const p = PROVIDER_BY_KEY[provider];
  if (!p) return NextResponse.json({ error: 'unknown provider' }, { status: 404 });

  const clientId = process.env[p.clientIdEnv];
  if (!clientId || !process.env[p.clientSecretEnv]) {
    return NextResponse.redirect(
      new URL(`/admin/connections?error=${encodeURIComponent(`${p.name} needs ${p.clientIdEnv} and ${p.clientSecretEnv} set in Vercel first.`)}`, req.url),
    );
  }

  // CSRF protection: the vendor must hand this same value back.
  const state = randomToken(24);
  const jar = await cookies();
  jar.set(`oauth_state_${provider}`, state, {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/',
  });

  const redirectUri = new URL(`/api/integrations/${provider}/callback`, req.nextUrl.origin).toString();
  const url = new URL(p.authUrl);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', p.scopes.join(provider === 'google_ads' ? ' ' : ','));
  if (provider === 'google_ads') {
    url.searchParams.set('access_type', 'offline'); // we need a refresh token
    url.searchParams.set('prompt', 'consent');
  }
  return NextResponse.redirect(url.toString());
}
