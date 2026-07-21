import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { getObjectStream } from '@/lib/storage/storage';
import { summarizeFile } from '@/lib/ai/gemini';
import { uploadToDrive, isDriveConfigured } from '@/lib/google/drive';
import { indexText, folderForFile } from '@/server/services/docqa-service';

/** The CRM folder path for a document, so Drive can mirror the same tree. */
async function folderPathFor(fileId: string): Promise<string[]> {
  const version = await prisma.documentVersion.findFirst({
    where: { fileId },
    select: { document: { select: { folderId: true } } },
    orderBy: { createdAt: 'desc' },
  });
  let folderId = version?.document?.folderId ?? null;
  const parts: string[] = [];
  for (let depth = 0; depth < 8 && folderId; depth++) {
    const f: { name: string; parentId: string | null } | null =
      await prisma.folder.findUnique({ where: { id: folderId }, select: { name: true, parentId: true } });
    if (!f) break;
    parts.unshift(f.name);
    folderId = f.parentId;
  }
  return parts;
}

/**
 * Everything slow about an upload, done after the browser has already been
 * told the upload succeeded: read the file once, summarise it, index it for
 * search, and mirror it into the matching Drive folder.
 */
export async function processFile(fileId: string): Promise<{ ok: boolean; detail: string }> {
  const file = await prisma.fileObject.findUnique({ where: { id: fileId } });
  if (!file) return { ok: false, detail: 'not found' };
  if (file.syncState === 'DONE') return { ok: true, detail: 'already done' };

  try {
    const { body } = await getObjectStream(file.key);
    const notes: string[] = [];

    if (file.size < 15 * 1024 * 1024) {
      const summary = await summarizeFile(body, file.mimeType, file.originalName);
      if (summary) {
        await prisma.fileObject.update({ where: { id: file.id }, data: { ocrText: summary } });
        notes.push('summarised');
        // Make it answerable straight away rather than waiting for a manual reindex.
        await indexText({ fileObjectId: file.id, title: file.originalName, source: 'Document library', text: summary, folderId: await folderForFile(file.id) })
          .then((n) => n > 0 && notes.push('indexed'))
          .catch(() => undefined);
      }
    }

    if (isDriveConfigured()) {
      const path = await folderPathFor(file.id);
      const drive = await uploadToDrive(file.originalName, file.mimeType, body, path);
      if ('error' in drive) {
        await prisma.fileObject.update({ where: { id: file.id }, data: { syncState: 'FAILED', syncError: drive.error.slice(0, 300) } });
        return { ok: false, detail: drive.error };
      }
      await prisma.fileObject.update({ where: { id: file.id }, data: { driveUrl: drive.webViewLink } });
      notes.push(path.length ? `copied to Drive/${path.join('/')}` : 'copied to Drive');
    }

    await prisma.fileObject.update({ where: { id: file.id }, data: { syncState: 'DONE', syncError: null } });
    return { ok: true, detail: notes.join(', ') || 'nothing to do' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'failed';
    await prisma.fileObject.update({ where: { id: file.id }, data: { syncState: 'FAILED', syncError: msg.slice(0, 300) } }).catch(() => undefined);
    return { ok: false, detail: msg };
  }
}

/** Catch anything the browser never got round to triggering. Called hourly. */
export async function processPending(limit = 10): Promise<{ processed: number; failed: number }> {
  const pending = await prisma.fileObject.findMany({
    where: { syncState: 'PENDING', size: { gt: 0, lt: 25 * 1024 * 1024 } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  });
  let processed = 0, failed = 0;
  for (const f of pending) {
    const r = await processFile(f.id);
    r.ok ? processed++ : failed++;
  }
  return { processed, failed };
}


export interface CatchUpResult { summarised: number; indexed: number; skipped: number; remaining: number; message: string }

/**
 * Summarise files that were uploaded while the AI was unavailable.
 *
 * processFile() skips anything already marked DONE, and processPending() only
 * looks at PENDING — so files uploaded during the outage were mirrored to Drive
 * and then left without a summary for ever. This goes back for them.
 *
 * Bounded per run because a serverless request cannot sit for minutes; the
 * result says how many are left so it can simply be pressed again.
 */
export async function summariseMissing(limit = 12): Promise<CatchUpResult> {
  const { summarizeFile } = await import('@/lib/ai/gemini');
  const { indexText, folderForFile } = await import('@/server/services/docqa-service');

  const where = { ocrText: null, size: { gt: 0, lt: 15 * 1024 * 1024 } };
  const [files, total] = await Promise.all([
    prisma.fileObject.findMany({
      where, orderBy: { createdAt: 'desc' }, take: limit,
      select: { id: true, key: true, mimeType: true, originalName: true },
    }),
    prisma.fileObject.count({ where }),
  ]);

  let summarised = 0, indexed = 0, skipped = 0;

  for (const f of files) {
    try {
      const { body } = await getObjectStream(f.key);
      const summary = await summarizeFile(body, f.mimeType, f.originalName);
      if (!summary) { skipped++; continue; }

      await prisma.fileObject.update({ where: { id: f.id }, data: { ocrText: summary } });
      summarised++;

      const n = await indexText({
        fileObjectId: f.id, title: f.originalName, source: 'Document library',
        text: summary, folderId: await folderForFile(f.id),
      }).catch(() => 0);
      if (n > 0) indexed++;
    } catch {
      skipped++;
    }
  }

  const remaining = Math.max(0, total - summarised);
  return {
    summarised, indexed, skipped, remaining,
    message: summarised === 0
      ? total === 0
        ? 'Every file already has a summary.'
        : `Nothing could be summarised. ${skipped} file${skipped === 1 ? '' : 's'} failed — check the provider on this page.`
      : `${summarised} file${summarised === 1 ? '' : 's'} summarised, ${indexed} made searchable.` +
        (remaining > 0 ? ` ${remaining} still to go — press it again.` : ' That is all of them.'),
  };
}
