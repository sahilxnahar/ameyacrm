import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { oauthProvider } from '@/config/oauth-providers';
import { openConfig } from '@/server/services/connector-runtime';
import { signState, redirectUriFor, buildAuthorizeUrl } from '@/lib/connectors/oauth';

export const dynamic = 'force-dynamic';

/** GET /api/connectors/oauth/<slug>/start — redirect the admin to the provider's consent screen. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getCurrentUser();
  if (!ctx || !can(ctx.permissions, 'admin.setting.manage')) {
    return NextResponse.redirect(new URL('/app-exchange', req.nextUrl.origin));
  }
  const provider = oauthProvider(slug);
  if (!provider) return NextResponse.json({ error: 'unknown provider' }, { status: 404 });

  const install = await prisma.connectorInstall.findUnique({ where: { slug } }).catch(() => null);
  const cfg = openConfig(install?.config as Record<string, unknown> | null);
  const clientId = String(cfg.clientId ?? '');
  if (!clientId) {
    return NextResponse.redirect(new URL('/app-exchange?oauth=missing-client', req.nextUrl.origin));
  }

  const origin = req.nextUrl.origin;
  const state = signState(slug, Date.now());
  const url = buildAuthorizeUrl(slug, { clientId, redirectUri: redirectUriFor(origin, slug), state });
  if (!url) return NextResponse.json({ error: 'cannot build authorize url' }, { status: 500 });
  return NextResponse.redirect(url);
}
