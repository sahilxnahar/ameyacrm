import { NextResponse, type NextRequest } from 'next/server';
import { authenticateApiToken } from '@/lib/api/token-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/ping — the sandbox test endpoint. Verifies a Bearer token and
 * echoes back the `echo` query param. Writes nothing, so partners can safely
 * test connectivity, auth and rate limits from the playground or their own code.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticateApiToken(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized', hint: 'Send an Authorization: Bearer <token> header.' }, { status: 401 });
  return NextResponse.json({
    ok: true,
    pong: true,
    echo: req.nextUrl.searchParams.get('echo') ?? null,
    tokenId: auth.tokenId,
    scopes: auth.scopes,
    at: new Date().toISOString(),
  });
}
