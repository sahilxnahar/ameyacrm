import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { getObjectStream, signedDownloadUrl } from '@/lib/storage/storage';
import { writeAudit } from '@/lib/audit/log';
import { lockedFolderIds, getFolderTree } from '@/server/services/folder-access-service';
import { isInlineSafe } from '@/lib/files/safety';

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

  // F-14: positive object-level authorization. If the file is filed under one or
  // more documents, the caller must actually be able to open one of those folders
  // (or own/have uploaded the file) — not merely hold the global download
  // permission. Orphan files (avatars, chat, ad-hoc uploads with no document) keep
  // the prior behaviour so those flows do not break.
  const links = await prisma.documentVersion.findMany({
    where: { fileId: file.id },
    select: { document: { select: { folderId: true, ownerId: true } } },
  });
  if (links.length) {
    const ownsFile = file.uploadedById === ctx.user.id;
    const ownsDoc = links.some((l) => l.document?.ownerId === ctx.user.id);
    let canOpen = ownsFile || ownsDoc;
    if (!canOpen) {
      const tree = await getFolderTree(ctx);
      // Explicit allow-set: a document whose folder is restricted OR soft-deleted
      // (and therefore absent from the tree) is NOT openable. Only a null-folder
      // "loose" file keeps the permissive default.
      const openable = new Set(tree.filter((f) => f.canOpen).map((f) => f.id));
      canOpen = links.some((l) => {
        const fid = l.document?.folderId ?? null;
        return fid === null ? true : openable.has(fid);
      });
    }
    if (!canOpen) {
      await writeAudit({ actorId: ctx.user.id, action: 'VIEW', entityType: 'FileObject', entityId: file.id, summary: `Blocked — ${file.originalName} is outside the caller's accessible folders` });
      return NextResponse.json({ error: 'You do not have access to this file.' }, { status: 403 });
    }
  }

  // Files that live in Drive have no copy in blob storage — send the viewer
  // there rather than trying to stream bytes that were never uploaded here.
  if (file.bucket === 'drive' && file.driveUrl) {
    await writeAudit({ actorId: ctx.user.id, action: 'VIEW', entityType: 'FileObject', entityId: file.id, summary: `Opened ${file.originalName} in Google Drive` });
    return NextResponse.redirect(file.driveUrl);
  }

  const download = req.nextUrl.searchParams.get('download') === '1';
  await writeAudit({ actorId: ctx.user.id, action: 'DOWNLOAD', entityType: 'FileObject', entityId: file.id, summary: `${download ? 'Downloaded' : 'Viewed'} ${file.originalName}` });

  /*
   * Never render something we are not sure is inert.
   *
   * `file.mimeType` is whatever the browser claimed at upload — see
   * registerUploadedDocument, which stores `file.type` verbatim. Serving those
   * bytes back with that type AND `Content-Disposition: inline` from our own
   * origin is same-origin script execution for anything the browser will run.
   * On the S3 and Blob providers the redirect below moves it off our origin,
   * but the `local` provider has no signed URL, so it streamed from here.
   *
   * Uploads are now filtered too (lib/files/safety.ts), so this is the second
   * of two locks — it also covers every file uploaded BEFORE that filter
   * existed, which is the set that actually matters today.
   */
  const inline = !download && isInlineSafe(file.mimeType, file.originalName);

  if (!download) {
    const signed = await signedDownloadUrl(file.key);
    if (signed) return NextResponse.redirect(signed);
  }
  const { body } = await getObjectStream(file.key);
  return new NextResponse(Buffer.from(body) as BodyInit, {
    headers: {
      'Content-Type': file.mimeType || 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.originalName)}"`,
      'Content-Length': String(file.size),
      // Stops the browser second-guessing the type and deciding a text/plain
      // file full of markup is really HTML.
      'X-Content-Type-Options': 'nosniff',
      // Belt to that brace: even if something does execute, it can reach nothing.
      'Content-Security-Policy': "default-src 'none'; sandbox; style-src 'unsafe-inline'",
    },
  });
}
