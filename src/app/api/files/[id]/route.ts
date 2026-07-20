import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { getObjectStream, signedDownloadUrl } from '@/lib/storage/storage';
import { writeAudit } from '@/lib/audit/log';
import { lockedFolderIds } from '@/server/services/folder-access-service';

/** Secure, audited file access for ANY type. ?download=1 forces a download; default previews inline. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!can(ctx.permissions, 'document.download')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await params;
  const file = await prisma.fileObject.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // A padlocked folder must actually stop the file being fetched, not merely
  // hide it in the list.
  const locked = await lockedFolderIds(ctx);
  if (locked.length) {
    const inLocked = await prisma.documentVersion.findFirst({
      where: { fileId: file.id, document: { folderId: { in: locked } } },
      select: { id: true },
    });
    if (inLocked) {
      await writeAudit({ actorId: ctx.user.id, action: 'VIEW', entityType: 'FileObject', entityId: file.id, summary: `Blocked — ${file.originalName} is in a restricted folder` });
      return NextResponse.json({ error: 'This document is in a restricted folder.' }, { status: 403 });
    }
  }

  const download = req.nextUrl.searchParams.get('download') === '1';
  await writeAudit({ actorId: ctx.user.id, action: 'DOWNLOAD', entityType: 'FileObject', entityId: file.id, summary: `${download ? 'Downloaded' : 'Viewed'} ${file.originalName}` });

  if (!download) {
    const signed = await signedDownloadUrl(file.key);
    if (signed) return NextResponse.redirect(signed);
  }
  const { body } = await getObjectStream(file.key);
  return new NextResponse(Buffer.from(body) as BodyInit, {
    headers: {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${encodeURIComponent(file.originalName)}"`,
      'Content-Length': String(file.size),
    },
  });
}
