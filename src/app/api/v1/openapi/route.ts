import { NextResponse, type NextRequest } from 'next/server';
import { buildOpenApiSpec } from '@/lib/api/openapi';

export const dynamic = 'force-dynamic';

/** GET /api/v1/openapi — the machine-readable OpenAPI 3.1 spec. Public (no secrets). */
export async function GET(req: NextRequest) {
  const base = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  return NextResponse.json(buildOpenApiSpec(base), {
    headers: { 'cache-control': 'public, max-age=300' },
  });
}
