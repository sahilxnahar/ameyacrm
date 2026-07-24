import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth/current-user';
import { checkDrive } from '@/lib/google/drive';

export const dynamic = 'force-dynamic';

/** Admin self-test: confirms the service account can see the configured Drive folder. */
export async function GET() {
  await requirePermission('admin.setting.manage');
  const res = await checkDrive();
  if ('error' in res) return NextResponse.json({ ok: false, ...res }, { status: 500 });
  return NextResponse.json({ ok: true, folder: res.folder, message: `Connected — documents will be copied into "${res.folder}".` });
}
