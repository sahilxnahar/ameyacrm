import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { processFile } from '@/server/services/file-sync-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Called by the browser immediately after an upload, without waiting for the
 * answer. Everything slow happens here instead of blocking the upload itself.
 */
export async function POST(req: NextRequest) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let fileId = '';
  try { fileId = String(((await req.json()) as { fileId?: string }).fileId ?? ''); } catch { /* ignore */ }
  if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 });

  const result = await processFile(fileId);
  return NextResponse.json(result);
}
