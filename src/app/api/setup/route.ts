import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { bootstrap } from '@/server/services/bootstrap';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // schema creation + seed can take a few seconds

/** GET → initialization status. */
export async function GET() {
  const userCount = await prisma.user.count().catch(() => -1);
  return NextResponse.json({ initialized: userCount > 0, userCount, db: userCount >= 0 ? 'up' : 'down' });
}

/**
 * POST → one-time database bootstrap (seed RBAC, departments, project, Super Admin).
 * First run (no users) is open; afterwards it requires ?secret=<SETUP_SECRET>.
 * Visit this once after deploying — no terminal required.
 */
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret') ?? req.headers.get('x-setup-secret');
  // The tables may not exist yet on a brand-new database — treat that as "not initialized".
  let userCount = 0;
  try {
    userCount = await prisma.user.count();
  } catch {
    userCount = 0;
  }
  if (userCount > 0 && (!env.SETUP_SECRET || secret !== env.SETUP_SECRET)) {
    return NextResponse.json({ error: 'Already initialized. Provide ?secret=SETUP_SECRET to re-run.' }, { status: 403 });
  }
  const result = await bootstrap();
  return NextResponse.json({
    ok: true,
    ...result,
    message: result.created
      ? 'Initialized. Sign in, then change the password immediately.'
      : 'Already initialized — no changes made.',
  });
}
