import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/current-user';
import { checkSchema } from '@/server/services/schema-check-service';

export const dynamic = 'force-dynamic';

/**
 * Bring the database up to date when the app itself will not render.
 *
 * The Repair button already existed, and it was unreachable in exactly the
 * situation it was built for. If the database is missing a column the signed-in
 * layout reads, that layout throws before anything inside it renders — so every
 * page becomes "Something went wrong", including every page carrying the button.
 * The recovery tool lived behind the failure it recovers from.
 *
 * This route does not render the app. It needs a valid session and the admin
 * permission, both of which are resolved from the session cookie alone, so it
 * works while every screen is down. Paste it in the address bar:
 *
 *   GET  /api/admin/repair   → what is missing (read-only, changes nothing)
 *   POST /api/admin/repair   → apply the missing pieces
 *
 * Every statement it runs is idempotent, so calling it twice is safe.
 */
export async function GET() {
  await requirePermission('admin.setting.manage');
  const { behind, missing } = await checkSchema();
  return NextResponse.json({
    behind,
    missing,
    next: behind
      ? 'POST to this same URL to apply the missing pieces.'
      : 'The database has everything this build expects.',
  });
}

export async function POST() {
  const ctx = await requirePermission('admin.setting.manage');
  const { repairSchema } = await import('@/server/services/bootstrap');
  const r = await repairSchema();

  // Audited like the button is — a schema change made from an address bar is
  // still a schema change, and it must be attributable.
  const { writeAudit } = await import('@/lib/audit/log');
  await writeAudit({
    actorId: ctx.user.id, action: 'UPDATE', entityType: 'Setting',
    summary: `Database repair via API: ${r.ran} statements applied, ${r.failed} failed on "${r.database}"`,
  }).catch(() => undefined);

  return NextResponse.json({
    applied: r.ran,
    failed: r.failed,
    database: r.database,
    usedDirectConnection: r.usedDirect,
    errors: r.errors,
    next: r.failed === 0
      ? 'Done. Reload the app.'
      : 'Some statements failed — the messages above say why. Fix those and POST again.',
  }, { status: r.failed === 0 ? 200 : 500 });
}
