import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { APP_VERSION } from '@/config/changelog';

export const dynamic = 'force-dynamic';

/**
 * Is this thing alive, which build is it, and can it read its own database?
 *
 * Deliberately needs no session. Every other diagnostic in this app lives behind
 * the signed-in layout, so when that layout cannot render — the exact situation
 * this is for — none of them is reachable and the only thing left is guessing.
 * `/api/*` sits outside both the middleware and that layout, so this answers
 * while everything else is down. It is also how you confirm WHICH build is
 * actually live, which is not the same question as which build you deployed.
 *
 * It reveals nothing an attacker does not already learn by loading the site: the
 * version, whether the database answers, and whether four specific columns this
 * build needs exist. No data, no table listing, no connection string.
 * `?verbose=1&token=<SETUP_SECRET>` adds the database NAME — which is what tells
 * you the app is pointed at a different Neon branch from the one you ran the SQL
 * on, far and away the commonest reason a fix appears to do nothing.
 */

/** The four the signed-in layout reads on every route. Miss one, lose every screen. */
const CRITICAL: Array<[string, string]> = [
  ['User', 'navPrefs'],
  ['User', 'topNavPrefs'],
  ['User', 'activeProjectId'],
  ['Project', 'isActive'],
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.SETUP_SECRET;
  const authorised =
    url.searchParams.get('verbose') === '1' && Boolean(secret) && url.searchParams.get('token') === secret;

  let dbOk = false;
  let database: string | null = null;
  let missingCritical: string[] = [];
  let knownMissing: string[] = [];
  let dbError: string | null = null;

  try {
    const who = await prisma.$queryRaw<Array<{ db: string }>>`SELECT current_database() AS db`;
    database = who[0]?.db ?? null;
    dbOk = true;

    const cols = await prisma.$queryRaw<Array<{ table_name: string; column_name: string }>>`
      SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = current_schema()
    `;
    const have = new Set(cols.map((c) => `${c.table_name}.${c.column_name}`));
    missingCritical = CRITICAL.filter(([t, c]) => !have.has(`${t}.${c}`)).map(([t, c]) => `${t}.${c}`);

    const { checkSchema } = await import('@/server/services/schema-check-service');
    knownMissing = (await checkSchema()).missing;
  } catch (e) {
    dbError = e instanceof Error ? e.message.slice(0, 200) : 'database unreachable';
  }

  const diagnosis = !dbOk
    ? 'The app cannot reach its database. Check DATABASE_URL.'
    : missingCritical.length > 0
      ? `The signed-in layout reads ${missingCritical.join(', ')}, and this database does not have ${missingCritical.length === 1 ? 'it' : 'them'}. Every screen fails until that is fixed: run UNBLOCK-LOGIN.sql against THIS database, then sign in and use Repair.`
      : knownMissing.length > 0
        ? 'The layout can render, but the database is behind this build. Sign in and use Repair, or POST /api/admin/repair.'
        : 'Healthy.';

  return NextResponse.json(
    {
      // Kept from the original shape so any existing uptime check still works.
      status: dbOk && missingCritical.length === 0 ? 'ok' : 'degraded',
      db: dbOk ? 'up' : 'down',
      time: new Date().toISOString(),

      version: APP_VERSION,
      database: {
        reachable: dbOk,
        ...(authorised ? { name: database } : {}),
        ...(dbError ? { error: dbError } : {}),
      },
      schema: {
        missingCriticalColumns: missingCritical,
        behindBy: knownMissing.length,
        ...(authorised ? { missing: knownMissing } : {}),
      },
      diagnosis,
    },
    { status: dbOk ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
