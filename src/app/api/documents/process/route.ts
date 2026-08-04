import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { prisma } from '@/lib/db/prisma';
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

  /*
   * Own it, or do not process it.
   *
   * This route authenticated the session and then took an arbitrary fileId. Any
   * signed-in person — including the lowest role — could trigger OCR and AI
   * summarisation of any file in the system, regardless of the folder
   * permissions every other document route enforces. It is called immediately
   * after an upload, so the only legitimate caller is the person who just
   * uploaded that file.
   */
  const file = await prisma.fileObject.findUnique({
    where: { id: fileId },
    select: { uploadedById: true },
  });
  if (!file) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (file.uploadedById !== ctx.user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const result = await processFile(fileId);
  return NextResponse.json(result);
}
