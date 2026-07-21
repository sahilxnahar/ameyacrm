'use server';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { putObject, makeObjectKey, getObjectStream } from '@/lib/storage/storage';
import { summarizeFile, isGeminiEnabled } from '@/lib/ai/gemini';
import { uploadToDrive, isDriveConfigured } from '@/lib/google/drive';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

export type DocResult = { ok: true; id: string; fileId?: string; message?: string } | { error: string };

const folderSchema = z.object({
  name: z.string().min(1).max(120),
  parentId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  visibility: z.enum(['PRIVATE', 'DEPARTMENT', 'PROJECT', 'ORGANIZATION']).default('DEPARTMENT'),
});

export async function createFolder(input: unknown): Promise<DocResult> {
  try {
    const ctx = await ensure('document.create');
    const d = folderSchema.parse(input);
    let path = '/';
    if (d.parentId) {
      const parent = await prisma.folder.findUnique({ where: { id: d.parentId } });
      if (parent) path = `${parent.path}${parent.id}/`;
    }
    const folder = await prisma.folder.create({
      data: { name: d.name, parentId: d.parentId || null, projectId: d.projectId || null, visibility: d.visibility, path, createdById: ctx.user.id },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Folder', entityId: folder.id, summary: `Created folder ${d.name}` });
    revalidatePath('/documents');
    return { ok: true, id: folder.id };
  } catch (err) {
    return toActionError(err);
  }
}

/** Upload a file into a folder — creates FileObject + Document + first version. */
export async function uploadDocument(formData: FormData): Promise<DocResult> {
  try {
    const ctx = await ensure('document.create');
    const file = formData.get('file');
    const folderId = String(formData.get('folderId') || '');
    const title = String(formData.get('title') || '');
    if (!(file instanceof File)) return { error: 'No file provided.' };
    if (!folderId) return { error: 'Select a folder.' };
    if (file.size > 50 * 1024 * 1024) return { error: 'File exceeds 50MB limit.' };

    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = createHash('sha256').update(buffer).digest('hex');
    const key = makeObjectKey(folderId, file.name);
    const stored = await putObject(key, buffer, file.type || 'application/octet-stream');

    const fileObj = await prisma.fileObject.create({
      data: { key: stored.key, bucket: stored.bucket, originalName: file.name, mimeType: file.type || 'application/octet-stream', size: stored.size, checksum, uploadedById: ctx.user.id },
    });
    const doc = await prisma.document.create({
      data: {
        title: title || file.name, folderId, ownerId: ctx.user.id, currentVersion: 1,
        versions: { create: { version: 1, fileId: fileObj.id, createdById: ctx.user.id } },
      },
    });
    try {
      const summary = await summarizeFile(buffer, file.type || 'application/octet-stream', file.name);
      if (summary) await prisma.fileObject.update({ where: { id: fileObj.id }, data: { ocrText: summary } });
    } catch { /* ignore */ }
    try {
      if (isDriveConfigured()) {
        const drive = await uploadToDrive(file.name, file.type || 'application/octet-stream', buffer);
        if (!('error' in drive)) await prisma.fileObject.update({ where: { id: fileObj.id }, data: { driveUrl: drive.webViewLink } });
      }
    } catch { /* ignore */ }
    await writeAudit({ actorId: ctx.user.id, action: 'UPLOAD', entityType: 'Document', entityId: doc.id, summary: `Uploaded ${file.name}` });
    revalidatePath('/documents');
    return { ok: true, id: doc.id, fileId: fileObj.id };
  } catch (err) {
    return toActionError(err);
  }
}

// ─── Folder permissions & document expiry (Documents depth) ─────────────────

const permSchema = z.object({
  folderId: z.string().min(1),
  principalType: z.enum(['user', 'department', 'role']),
  userId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'MANAGER', 'EXECUTIVE', 'EMPLOYEE', 'READ_ONLY', 'GUEST']).optional().nullable(),
  level: z.enum(['VIEW', 'COMMENT', 'EDIT', 'MANAGE']).default('VIEW'),
});

export async function setFolderPermission(input: unknown): Promise<DocResult> {
  try {
    const ctx = await ensure('document.manage');
    const d = permSchema.parse(input);
    const data = {
      folderId: d.folderId, level: d.level,
      userId: d.principalType === 'user' ? d.userId || null : null,
      departmentId: d.principalType === 'department' ? d.departmentId || null : null,
      role: d.principalType === 'role' ? d.role ?? null : null,
    };
    if (!data.userId && !data.departmentId && !data.role) return { error: 'Choose a user, department or role.' };
    const perm = await prisma.folderPermission.create({ data });
    await writeAudit({ actorId: ctx.user.id, action: 'PERMISSION_CHANGE', entityType: 'Folder', entityId: d.folderId, summary: `Granted ${d.level} access` });
    revalidatePath('/documents');
    return { ok: true, id: perm.id };
  } catch (err) { return toActionError(err); }
}

export async function removeFolderPermission(id: string): Promise<DocResult> {
  try {
    const ctx = await ensure('document.manage');
    const perm = await prisma.folderPermission.delete({ where: { id } });
    await writeAudit({ actorId: ctx.user.id, action: 'PERMISSION_CHANGE', entityType: 'Folder', entityId: perm.folderId, summary: 'Revoked access' });
    revalidatePath('/documents');
    return { ok: true, id };
  } catch (err) { return toActionError(err); }
}

export async function updateDocumentExpiry(documentId: string, expiresAt: string | null): Promise<DocResult> {
  try {
    const ctx = await ensure('document.update');
    await prisma.document.update({ where: { id: documentId }, data: { expiresAt: expiresAt ? new Date(expiresAt) : null } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Document', entityId: documentId, summary: expiresAt ? `Expiry set ${expiresAt}` : 'Expiry cleared' });
    revalidatePath('/documents');
    return { ok: true, id: documentId };
  } catch (err) { return toActionError(err); }
}

/** Re-run (or run) the AI summary for a document on demand. */
export async function summarizeDocument(documentId: string): Promise<DocResult> {
  try {
    await ensure('document.update');
    if (!isGeminiEnabled()) return { error: 'Gemini API key is not configured (set GEMINI_API_KEY).' };
    const doc = await prisma.document.findUnique({ where: { id: documentId }, include: { versions: { orderBy: { version: 'desc' }, take: 1, include: { file: true } } } });
    const file = doc?.versions[0]?.file;
    if (!file) return { error: 'File not found.' };
    const { body } = await getObjectStream(file.key);
    const summary = await summarizeFile(body, file.mimeType, file.originalName);
    if (!summary) return { error: 'Could not summarize this file type (PDF, image and text are supported).' };
    await prisma.fileObject.update({ where: { id: file.id }, data: { ocrText: summary } });
    revalidatePath('/documents');
    return { ok: true, id: documentId };
  } catch (err) { return toActionError(err); }
}

const registerSchema = z.object({
  folderId: z.string().min(1),
  title: z.string().max(200).optional(),
  url: z.string().min(5).max(1000),
  originalName: z.string().min(1).max(255),
  mimeType: z.string().max(120).default('application/octet-stream'),
  size: z.coerce.number().int().nonnegative().default(0),
  subPath: z.array(z.string().max(80)).max(6).optional(), // folders the file came from
});
/** Records a file that the browser uploaded straight to blob storage (bulk / large-file path). */
export async function registerUploadedDocument(input: unknown): Promise<DocResult> {
  try {
    const ctx = await ensure('document.create');
    const d = registerSchema.parse(input);

    // A whole folder was dropped: recreate the same tree in the CRM so it can
    // be mirrored into Drive with the same shape.
    let targetFolderId = d.folderId;
    if (d.subPath?.length) {
      let parentId: string | null = d.folderId ?? null;
      for (const raw of d.subPath) {
        const name = raw.trim().slice(0, 80);
        if (!name || name === '.' || name === '..') continue;
        const existing: { id: string } | null = await prisma.folder.findFirst({
          where: { name, parentId, deletedAt: null }, select: { id: true },
        });
        if (existing) { parentId = existing.id; continue; }
        const created: { id: string } = await prisma.folder.create({
          data: { name, parentId, createdById: ctx.user.id, path: name, visibility: 'DEPARTMENT' },
          select: { id: true },
        });
        parentId = created.id;
      }
      targetFolderId = parentId ?? undefined;
    }

    // Document.folderId is required. A file dropped at the top level, or one
    // arriving from Drive with no path, has no folder — so give it a home
    // rather than letting Prisma throw.
    if (!targetFolderId) {
      const home =
        (await prisma.folder.findFirst({ where: { name: 'Unfiled', parentId: null, deletedAt: null }, select: { id: true } })) ??
        (await prisma.folder.create({ data: { name: 'Unfiled', parentId: null, createdById: ctx.user.id, path: 'Unfiled', visibility: 'DEPARTMENT' } }));
      targetFolderId = home.id;
    }

    const fileObj = await prisma.fileObject.create({
      data: { key: d.url, bucket: 'blob', originalName: d.originalName, mimeType: d.mimeType, size: d.size, uploadedById: ctx.user.id },
    });
    const doc = await prisma.document.create({
      data: {
        title: d.title?.trim() || d.originalName, folderId: targetFolderId, ownerId: ctx.user.id, currentVersion: 1,
        versions: { create: { version: 1, fileId: fileObj.id, createdById: ctx.user.id } },
      },
    });
    // Nothing slow happens here.
    //
    // The AI summary and the Google Drive copy used to run inside this request,
    // which is why a 300KB file felt slow — the browser was waiting on a Gemini
    // round trip and a base64 upload to Apps Script, not on the file transfer.
    // They are now marked pending and done afterwards by /api/documents/process.
    await prisma.fileObject.update({
      where: { id: fileObj.id },
      data: { syncState: d.size > 0 && d.size < 25 * 1024 * 1024 ? 'PENDING' : 'SKIPPED' },
    });

    await writeAudit({ actorId: ctx.user.id, action: 'UPLOAD', entityType: 'Document', entityId: doc.id, summary: `Uploaded ${d.originalName}` });
    revalidatePath('/documents');
    return { ok: true, id: doc.id };
  } catch (err) { return toActionError(err); }
}

export async function renameDocument(documentId: string, title: string): Promise<DocResult> {
  try {
    const ctx = await ensure('document.update');
    const clean = String(title || '').trim().slice(0, 200);
    if (clean.length < 1) return { error: 'Give the document a name.' };
    await prisma.document.update({ where: { id: documentId }, data: { title: clean } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Document', entityId: documentId, summary: `Renamed to ${clean}` });
    revalidatePath('/documents');
    return { ok: true, id: documentId };
  } catch (err) { return toActionError(err); }
}

export async function moveDocument(documentId: string, folderId: string): Promise<DocResult> {
  try {
    const ctx = await ensure('document.update');
    const folder = await prisma.folder.findUnique({ where: { id: folderId }, select: { id: true, name: true } });
    if (!folder) return { error: 'Target folder not found.' };
    await prisma.document.update({ where: { id: documentId }, data: { folderId } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Document', entityId: documentId, summary: `Moved to ${folder.name}` });
    revalidatePath('/documents');
    return { ok: true, id: documentId };
  } catch (err) { return toActionError(err); }
}

/** Push (or re-push) a document's file into the connected Google Drive folder. */
export async function sendDocumentToDrive(documentId: string): Promise<DocResult> {
  try {
    const ctx = await ensure('document.update');
    if (!isDriveConfigured()) return { error: 'Google Drive is not connected. Add the service-account keys and GOOGLE_DRIVE_FOLDER_ID in Vercel.' };
    const doc = await prisma.document.findUnique({ where: { id: documentId }, include: { versions: { orderBy: { version: 'desc' }, take: 1, include: { file: true } } } });
    const file = doc?.versions[0]?.file;
    if (!file) return { error: 'File not found.' };
    if (file.size > 25 * 1024 * 1024) return { error: 'File is too large to copy to Drive from here (25MB limit).' };
    const { body } = await getObjectStream(file.key);
    const drive = await uploadToDrive(file.originalName, file.mimeType, body);
    if ('error' in drive) return { error: drive.error };
    await prisma.fileObject.update({ where: { id: file.id }, data: { driveUrl: drive.webViewLink } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Document', entityId: documentId, summary: `Copied ${file.originalName} to Google Drive` });
    revalidatePath('/documents');
    return { ok: true, id: documentId };
  } catch (err) { return toActionError(err); }
}

/** Move several documents at once. Refuses to drop anything into a folder you cannot open. */
export async function moveDocuments(documentIds: string[], folderId: string): Promise<DocResult> {
  try {
    const ctx = await ensure('document.update');
    const ids = documentIds.slice(0, 300);
    if (!ids.length) return { error: 'Nothing selected.' };

    const { lockedFolderIds } = await import('@/server/services/folder-access-service');
    const locked = await lockedFolderIds(ctx);
    if (locked.includes(folderId)) return { error: 'You cannot move files into a folder you do not have access to.' };

    const r = await prisma.document.updateMany({
      where: { id: { in: ids }, deletedAt: null, ...(locked.length ? { folderId: { notIn: locked } } : {}) },
      data: { folderId },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Document', summary: `Moved ${r.count} document(s)` });
    revalidatePath('/documents');
    return { ok: true, id: folderId, message: `${r.count} moved.` } as DocResult;
  } catch (err) { return toActionError(err); }
}

/** Rename a folder. */
export async function renameFolder(folderId: string, name: string): Promise<DocResult> {
  try {
    const ctx = await ensure('document.manage');
    const clean = name.trim().slice(0, 80);
    if (clean.length < 1) return { error: 'Give the folder a name.' };
    await prisma.folder.update({ where: { id: folderId }, data: { name: clean, path: clean } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Document', entityId: folderId, summary: `Renamed folder to ${clean}` });
    revalidatePath('/documents');
    return { ok: true, id: folderId };
  } catch (err) { return toActionError(err); }
}

/** Move a folder under another one. Refuses to create a loop. */
export async function moveFolder(folderId: string, parentId: string | null): Promise<DocResult> {
  try {
    const ctx = await ensure('document.manage');
    if (folderId === parentId) return { error: 'A folder cannot sit inside itself.' };
    let cur: string | null = parentId;
    for (let i = 0; i < 10 && cur; i++) {
      if (cur === folderId) return { error: 'That would put the folder inside one of its own subfolders.' };
      const up: { parentId: string | null } | null = await prisma.folder.findUnique({ where: { id: cur }, select: { parentId: true } });
      cur = up?.parentId ?? null;
    }
    await prisma.folder.update({ where: { id: folderId }, data: { parentId } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Document', entityId: folderId, summary: 'Moved a folder' });
    revalidatePath('/documents');
    return { ok: true, id: folderId };
  } catch (err) { return toActionError(err); }
}
