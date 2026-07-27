import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { fetchWithTimeout } from '@/lib/utils/fetch-timeout';
import { encrypt } from '@/lib/utils/crypto';
import { oauthProvider } from '@/config/oauth-providers';
import { openConfig } from '@/server/services/connector-runtime';
import { verifyState, redirectUriFor } from '@/lib/connectors/oauth';

export const dynamic = 'force-dynamic';

/** GET /api/connectors/oauth/<slug>/callback — exchange the code for tokens and store them. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const origin = req.nextUrl.origin;
  const back = (status: string) => NextResponse.redirect(new URL(`/app-exchange?oauth=${status}&app=${slug}`, origin));

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state') || '';
  if (req.nextUrl.searchParams.get('error')) return back('denied');
  if (!code) return back('nocode');

  const verified = verifyState(state, Date.now());
  if (!verified || verified.slug !== slug) return back('badstate');

  const provider = oauthProvider(slug);
  if (!provider) return back('unknown');

  const install = await prisma.connectorInstall.findUnique({ where: { slug } }).catch(() => null);
  const cfg = openConfig(install?.config as Record<string, unknown> | null);
  const clientId = String(cfg.clientId ?? '');
  const clientSecret = String(cfg.clientSecret ?? '');
  if (!clientId || !clientSecret) return back('missing-client');

  try {
    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUriFor(origin, slug),
      client_id: clientId,
      client_secret: clientSecret,
    });
    const res = await fetchWithTimeout(provider.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: form.toString(),
    }, 12000);
    const tok = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const accessToken = String(tok.access_token ?? '');
    if (!res.ok || !accessToken) return back('exchange-failed');

    await prisma.integrationConnection.upsert({
      where: { provider: slug },
      update: {
        status: 'CONNECTED',
        accessToken: encrypt(accessToken),
        refreshToken: tok.refresh_token ? encrypt(String(tok.refresh_token)) : null,
        expiresAt: tok.expires_in ? new Date(Date.now() + Number(tok.expires_in) * 1000) : null,
        scopes: provider.scope,
        connectedAt: new Date(),
        lastError: null,
      },
      create: {
        provider: slug,
        status: 'CONNECTED',
        accessToken: encrypt(accessToken),
        refreshToken: tok.refresh_token ? encrypt(String(tok.refresh_token)) : null,
        expiresAt: tok.expires_in ? new Date(Date.now() + Number(tok.expires_in) * 1000) : null,
        scopes: provider.scope,
        connectedAt: new Date(),
      },
    });
    // Reflect connected state on the install too.
    await prisma.connectorInstall.upsert({
      where: { slug },
      update: { status: 'INSTALLED' },
      create: { slug, status: 'INSTALLED' },
    }).catch(() => undefined);

    return back('connected');
  } catch {
    return back('error');
  }
}
