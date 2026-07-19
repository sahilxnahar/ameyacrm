'use server';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { putObject, makeObjectKey, getObjectStream } from '@/lib/storage/storage';
import { summarizeFile, isGeminiEnabled } from '@/lib/ai/gemini';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

export type DocResult = { ok: true; id: string } | { error: string };

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
    await writeAudit({ actorId: ctx.user.id, action: 'UPLOAD', entityType: 'Document', entityId: doc.id, summary: `Uploaded ${file.name}` });
    revalidatePath('/documents');
    return { ok: true, id: doc.id };
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
