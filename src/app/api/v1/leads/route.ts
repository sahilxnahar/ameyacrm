import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { authenticateApiToken } from '@/lib/api/token-auth';

export const dynamic = 'force-dynamic';

/** GET /api/v1/leads?limit=100&status=NEW — Bearer API token required. */
export async function GET(req: NextRequest) {
  const auth = await authenticateApiToken(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const limit = Math.min(500, Number(req.nextUrl.searchParams.get('limit') || 100) || 100);
  const status = req.nextUrl.searchParams.get('status') || undefined;
  const leads = await prisma.lead.findMany({
    where: { deletedAt: null, ...(status ? { status: status as never } : {}) },
    orderBy: { updatedAt: 'desc' }, take: limit,
    select: { id: true, reference: true, name: true, email: true, phone: true, source: true, status: true, score: true, budgetMax: true, requirement: true, customFields: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json({ ok: true, count: leads.length, data: leads });
}
