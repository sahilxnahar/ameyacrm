import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/current-user';
import { env } from '@/config/env';
import { putObject, deleteObject } from '@/lib/storage/storage';

export const dynamic = 'force-dynamic';

/** Admin self-test: writes then deletes a tiny file to prove storage is configured. */
export async function GET() {
  await requirePermission('admin.setting.manage');
  const provider = env.STORAGE_PROVIDER;
  const hasToken = Boolean(env.BLOB_READ_WRITE_TOKEN);
  try {
    const res = await putObject(`healthcheck/${Date.now()}.txt`, Buffer.from('ok'), 'text/plain');
    await deleteObject(res.key).catch(() => undefined);
    return NextResponse.json({ ok: true, provider, blobTokenPresent: hasToken, message: 'Storage is working — uploads will succeed.' });
  } catch (err) {
    return NextResponse.json({ ok: false, provider, blobTokenPresent: hasToken, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
