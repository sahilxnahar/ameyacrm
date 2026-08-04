import { NextResponse, type NextRequest } from 'next/server';
import { asEnumOrUndefined } from '@/lib/utils/enum';
import { UnitStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { authenticateApiToken, hasScope } from '@/lib/api/token-auth';

export const dynamic = 'force-dynamic';

/** GET /api/v1/units?status=AVAILABLE — Bearer API token required. */
export async function GET(req: NextRequest) {
  const auth = await authenticateApiToken(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const status = req.nextUrl.searchParams.get('status') || undefined;
  const units = await prisma.unit.findMany({
    where: { status: asEnumOrUndefined(UnitStatus, status) },
    orderBy: [{ tower: 'asc' }, { code: 'asc' }], take: 1000,
    select: { id: true, code: true, tower: true, floor: true, typology: true, facing: true, carpetAreaSqft: true, price: true, status: true, project: { select: { name: true, code: true } } },
  });
  return NextResponse.json({ ok: true, count: units.length, data: units });
}
