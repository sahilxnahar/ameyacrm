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
