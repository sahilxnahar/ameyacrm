import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { limitOr429, callerIp } from '@/lib/security/rate-limit';
import { notifyMany } from '@/lib/notifications/notify';
import { writeAudit } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface DriveFile { id: string; name: string; mimeType: string; size: number; url: string; path: string[] }

/**
 * Files added straight into Google Drive, coming the other way.
 *
 * Anything dropped into the connected Drive folder becomes a document in the
 * CRM, inside a folder tree that matches the one in Drive. Files the CRM itself
 * put there are recognised by their Drive id and skipped, so a file never
 * bounces back and forth.
 *
 * Auth: INGEST_SECRET.
 */
export async function POST(req: NextRequest) {
  const over = await limitOr429(`ingest:drive:${await callerIp()}`, 30, 60);
  if (over) return over;

  const secret = env.INGEST_SECRET;
  const key = req.headers.get('x-ingest-key') || req.nextUrl.searchParams.get('key');
  if (!secret || key !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let files: DriveFile[] = [];
  try {
    const body = (await req.json()) as { files?: DriveFile[] };
    files = Array.isArray(body.files) ? body.files : [];
  } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  try {
  // Whoever owns the connector is credited as the uploader.
  const owner = await prisma.user.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, status: 'ACTIVE', deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!owner) return NextResponse.json({ error: 'no administrator to attribute files to' }, { status: 400 });

  let imported = 0, skipped = 0;
  const failures: Array<{ name: string; error: string }> = [];
  const folderCache = new Map<string, string>();

  /**
   * Document.folderId is required, so a file sitting at the root of the Drive
   * folder — the most common case — needs somewhere to live. One shared
   * top-level folder rather than refusing the file.
   */
  async function rootFolderId(): Promise<string> {
    const existing = await prisma.folder.findFirst({
      where: { name: 'From Google Drive', parentId: null, deletedAt: null },
      select: { id: true },
    });
    if (existing) return existing.id;
    const made = await prisma.folder.create({
      data: { name: 'From Google Drive', parentId: null, createdById: owner!.id, path: 'From Google Drive', visibility: 'DEPARTMENT' },
    });
    return made.id;
  }

  /** Find or create the CRM folder matching a Drive path. Never returns null. */
  async function folderFor(path: string[]): Promise<string> {
    const clean = (path ?? []).map((x) => String(x).trim().slice(0, 80)).filter(Boolean).slice(0, 8);
    const cacheKey = clean.join('/');
    if (folderCache.has(cacheKey)) return folderCache.get(cacheKey)!;

    if (!clean.length) {
      const id = await rootFolderId();
      folderCache.set(cacheKey, id);
      return id;
    }

    let parentId: string | null = null;
    for (const name of clean) {
      const existing: { id: string } | null = await prisma.folder.findFirst({
        where: { name, parentId, deletedAt: null }, select: { id: true },
      });
      parentId = existing
        ? existing.id
        : (await prisma.folder.create({
            data: { name, parentId, createdById: owner!.id, path: name, visibility: 'DEPARTMENT' },
          })).id;
    }
    folderCache.set(cacheKey, parentId!);
    return parentId!;
  }

  for (const f of files.slice(0, 200)) {
    if (!f?.id || !f.name) { skipped++; continue; }
    try {

    // Already here — either imported before, or the CRM put it there itself.
    const seen = await prisma.fileObject.findFirst({
      where: { OR: [{ key: `drive:${f.id}` }, { driveUrl: { contains: f.id } }] },
      select: { id: true },
    });
    if (seen) { skipped++; continue; }

    const folderId = await folderFor(f.path ?? []);

    const fileObj = await prisma.fileObject.create({
      data: {
        key: `drive:${f.id}`,           // it lives in Drive, not in blob storage
        bucket: 'drive',
        originalName: f.name.slice(0, 250),
        mimeType: f.mimeType || 'application/octet-stream',
        size: Number(f.size) || 0,
        uploadedById: owner.id,
        driveUrl: f.url,
        syncState: 'DONE',              // it is already where it needs to be
      },
    });

    await prisma.document.create({
      data: {
        title: f.name.replace(/\.[a-z0-9]{1,5}$/i, '').slice(0, 200) || f.name,
        folderId, ownerId: owner.id, currentVersion: 1,
        versions: { create: { version: 1, fileId: fileObj.id, createdById: owner.id } },
      },
    });
      imported++;
    } catch (err) {
      // One unreadable file must not lose the rest of the batch.
      failures.push({ name: f.name, error: err instanceof Error ? err.message.slice(0, 200) : 'failed' });
    }
  }

  if (imported > 0) {
    const admins = await prisma.user.findMany({
      where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, status: 'ACTIVE', deletedAt: null },
      select: { id: true },
    });
    await notifyMany(admins.map((a) => a.id), {
      type: 'DOCUMENT',
      title: `${imported} file${imported === 1 ? '' : 's'} added from Google Drive`,
      body: 'They now appear in Documents for everyone with access.',
      link: '/documents',
    });
    await writeAudit({ actorId: owner.id, action: 'UPLOAD', entityType: 'Document', summary: `Imported ${imported} files from Google Drive` });
  }

  return NextResponse.json({ ok: true, imported, skipped, failed: failures.length, failures: failures.slice(0, 5) });
  } catch (err) {
    // Whatever goes wrong, say so. A blank 500 tells nobody anything.
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message.slice(0, 300) : 'import failed' },
      { status: 500 },
    );
  }
}
