import { NextResponse, type NextRequest } from 'next/server';
import { requireBearerSecret } from '@/lib/security/require-secret';
import { env } from '@/config/env';
import { writeAudit } from '@/lib/audit/log';
import { takeEncryptedBackup } from '@/server/services/backup-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Nightly automated backup — writes a JSON snapshot to object storage. */
/**
 * Nightly automated backup — an encrypted JSON snapshot in object storage.
 *
 * The work lives in backup-service.ts, shared with the nightly pass, because
 * two backup implementations is how the safe one ends up being the one that is
 * not scheduled. This route stays for manual and external-scheduler use.
 */
export async function GET(req: NextRequest) {
  const denied = requireBearerSecret(req, env.CRON_SECRET);
  if (denied) return denied;

  const stamp = new Date().toISOString().slice(0, 10);
  try {
    const result = await takeEncryptedBackup(new Date());
    return NextResponse.json({ ok: true, storedAs: result.key, sizeKb: result.sizeKb });
  } catch (err) {
    /*
     * ── AMH-034 ────────────────────────────────────────────────────────────
     *
     * This used to swallow the storage error, write an audit line saying the
     * backup had happened, and return HTTP 200. It had been failing on bad S3
     * credentials and reporting success in all three places — worse than no
     * backup, because it removed every reason to check.
     */
    const detail = err instanceof Error ? err.message : String(err);
    await writeAudit({
      action: 'EXPORT', entityType: 'Backup',
      summary: `Automated backup ${stamp} FAILED — nothing was stored. ${detail}`,
    }).catch(() => undefined);
    // 500, not 200: a scheduler decides whether to alert from the status code.
    return NextResponse.json({
      ok: false,
      error: 'The backup was built but could not be stored.',
      detail,
    }, { status: 500 });
  }
}
