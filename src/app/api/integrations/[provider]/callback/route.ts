import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { PROVIDER_BY_KEY } from '@/config/providers';
import { encrypt, safeEqual } from '@/lib/utils/crypto';
import { writeAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

const back = (req: NextRequest, msg: string, ok = false) =>
  NextResponse.redirect(new URL(`/admin/connections?${ok ? 'ok' : 'error'}=${encodeURIComponent(msg)}`, req.url));

/** Step 2: swap the code for a token, store it encrypted, and record who did it. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!can(ctx.permissions, 'admin.setting.manage')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { provider } = await params;
  const p = PROVIDER_BY_KEY[provider];
  if (!p) return NextResponse.json({ error: 'unknown provider' }, { status: 404 });

  const denied = req.nextUrl.searchParams.get('error_description') ?? req.nextUrl.searchParams.get('error');
  if (denied) return back(req, `${p.name} refused: ${denied}`);

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const jar = await cookies();
  const expected = jar.get(`oauth_state_${provider}`)?.value;
  jar.delete(`oauth_state_${provider}`);

  if (!code) return back(req, 'No authorisation code came back.');
  if (!state || !expected || !safeEqual(state, expected)) {
    return back(req, 'The security check failed. Start the connection again from this page.');
  }

  const clientId = process.env[p.clientIdEnv];
  const clientSecret = process.env[p.clientSecretEnv];
  if (!clientId || !clientSecret) return back(req, `${p.clientIdEnv} / ${p.clientSecretEnv} are not set.`);

  const redirectUri = new URL(`/api/integrations/${provider}/callback`, req.nextUrl.origin).toString();

  try {
    const body = new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      redirect_uri: redirectUri, code, grant_type: 'authorization_code',
    });
    const res = await fetch(p.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
    });
    const text = await res.text();
    if (!res.ok) return back(req, `${p.name} rejected the exchange (HTTP ${res.status}). ${text.slice(0, 160)}`);

    const tok = JSON.parse(text) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
    if (!tok.access_token) return back(req, `${p.name} returned no access token.`);

    // A token alone cannot send anything. WhatsApp needs the business account
    // and the phone number to send from, so look them up now rather than
    // failing later with an unhelpful error.
    let meta: Record<string, unknown> | undefined;
    let accountName: string | null = null;
    let lookupWarning: string | null = null;
    if (provider === 'whatsapp') {
      const { discoverWabaDetails } = await import('@/server/services/whatsapp-service');
      const d = await discoverWabaDetails(tok.access_token);
      meta = { wabaId: d.wabaId, phoneNumberId: d.phoneNumberId, displayNumber: d.displayNumber };
      accountName = d.displayNumber ? `${d.businessName ?? 'WhatsApp'} · ${d.displayNumber}` : d.businessName;
      lookupWarning = d.error;
    }

    await prisma.integrationConnection.upsert({
      where: { provider },
      update: {
        status: 'CONNECTED',
        accountName, meta: meta as never, lastError: lookupWarning,
        accessToken: encrypt(tok.access_token),
        refreshToken: tok.refresh_token ? encrypt(tok.refresh_token) : null,
        expiresAt: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000) : null,
        scopes: tok.scope ?? p.scopes.join(' '),
        lastCheckedAt: new Date(),
        connectedById: ctx.user.id, connectedAt: new Date(),
      },
      create: {
        provider, status: 'CONNECTED',
        accountName, meta: meta as never, lastError: lookupWarning,
        accessToken: encrypt(tok.access_token),
        refreshToken: tok.refresh_token ? encrypt(tok.refresh_token) : null,
        expiresAt: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000) : null,
        scopes: tok.scope ?? p.scopes.join(' '),
        connectedById: ctx.user.id, connectedAt: new Date(), lastCheckedAt: new Date(),
      },
    });

    await writeAudit({
      actorId: ctx.user.id, action: 'UPDATE', entityType: 'Integration', entityId: provider,
      summary: `Connected ${p.name}`,
    });
    if (lookupWarning) return back(req, `${p.name} is connected, but it cannot send yet: ${lookupWarning}`);
    return back(req, `${p.name} is connected${accountName ? ` — ${accountName}` : ''}.`, true);
  } catch (e) {
    return back(req, e instanceof Error ? e.message : 'The connection failed.');
  }
}
