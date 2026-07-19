'use server';
import { z } from 'zod';
import { randomUUID, createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import type { IssueStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { nextReference } from '@/lib/utils/reference';
import { putObject } from '@/lib/storage/storage';
import { writeAudit } from '@/lib/audit/log';
import { notify } from '@/lib/notifications/notify';
import { ensure, toActionError } from './_helpers';

export type ArchResult = { ok: true; id: string } | { error: string };

async function storeFile(file: File, uploadedById: string) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `drawings/${Date.now()}-${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const stored = await putObject(key, buffer, file.type || 'application/octet-stream');
  return prisma.fileObject.create({
    data: { key: stored.key, bucket: stored.bucket, originalName: file.name, mimeType: file.type || 'application/octet-stream', size: stored.size, checksum: createHash('sha256').update(buffer).digest('hex'), uploadedById },
  });
}

/** Create a drawing with its first revision (optionally uploading the file). */
export async function createDrawing(formData: FormData): Promise<ArchResult> {
  try {
    const ctx = await ensure('architecture.manage');
    const number = String(formData.get('number') || '').trim();
    const title = String(formData.get('title') || '').trim();
    const discipline = String(formData.get('discipline') || 'Architecture');
    const projectId = String(formData.get('projectId') || '') || null;
    if (number.length < 1 || title.length < 2) return { error: 'Drawing number and title are required.' };
    const file = formData.get('file');

    let fileId: string | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > 50 * 1024 * 1024) return { error: 'File exceeds 50MB limit.' };
      fileId = (await storeFile(file, ctx.user.id)).id;
    }
    const drawing = await prisma.drawing.create({
      data: {
        number, title, discipline, projectId, createdById: ctx.user.id, currentRevision: 1,
        revisions: { create: { revision: 1, fileId, notes: 'Initial revision', createdById: ctx.user.id } },
      },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Drawing', entityId: drawing.id, summary: `Created drawing ${number}` });
    revalidatePath('/architecture');
    return { ok: true, id: drawing.id };
  } catch (err) { return toActionError(err); }
}

export async function addDrawingRevision(formData: FormData): Promise<ArchResult> {
  try {
    const ctx = await ensure('architecture.manage');
    const drawingId = String(formData.get('drawingId') || '');
    const notes = String(formData.get('notes') || '') || null;
    const file = formData.get('file');
    const drawing = await prisma.drawing.findUnique({ where: { id: drawingId } });
    if (!drawing) return { error: 'Drawing not found.' };
    let fileId: string | null = null;
    if (file instanceof File && file.size > 0) fileId = (await storeFile(file, ctx.user.id)).id;
    const revision = drawing.currentRevision + 1;
    await prisma.$transaction([
      prisma.drawingRevision.create({ data: { drawingId, revision, fileId, notes, createdById: ctx.user.id } }),
      prisma.drawing.update({ where: { id: drawingId }, data: { currentRevision: revision, status: 'FOR_REVIEW' } }),
    ]);
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'Drawing', entityId: drawingId, summary: `Added revision ${revision}` });
    revalidatePath('/architecture');
    return { ok: true, id: drawingId };
  } catch (err) { return toActionError(err); }
}

const rfiSchema = z.object({
  subject: z.string().min(3).max(200),
  question: z.string().min(3).max(4000),
  projectId: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  consultantId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});
export async function createRFI(input: unknown): Promise<ArchResult> {
  try {
    const ctx = await ensure('architecture.manage');
    const d = rfiSchema.parse(input);
    const number = await nextReference('RFI');
    const rfi = await prisma.rFI.create({
      data: { number, subject: d.subject, question: d.question, projectId: d.projectId || null, raisedById: ctx.user.id, assignedToId: d.assignedToId || null, consultantId: d.consultantId || null, dueDate: d.dueDate ? new Date(d.dueDate) : null },
    });
    if (d.assignedToId) await notify({ userId: d.assignedToId, type: 'SYSTEM', title: `RFI ${number}: ${d.subject}`, link: '/architecture' });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'RFI', entityId: rfi.id, summary: `Raised ${number}` });
    revalidatePath('/architecture');
    return { ok: true, id: rfi.id };
  } catch (err) { return toActionError(err); }
}

export async function answerRFI(id: string, response: string): Promise<ArchResult> {
  try {
    const ctx = await ensure('architecture.manage');
    if (!response.trim()) return { error: 'Response cannot be empty.' };
    const rfi = await prisma.rFI.update({ where: { id }, data: { response, status: 'ANSWERED', answeredAt: new Date() } });
    if (rfi.raisedById) await notify({ userId: rfi.raisedById, type: 'SYSTEM', title: `RFI ${rfi.number} answered`, link: '/architecture' });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'RFI', entityId: id, summary: `Answered ${rfi.number}` });
    revalidatePath('/architecture');
    return { ok: true, id };
  } catch (err) { return toActionError(err); }
}

const issueSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(2000).optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  projectId: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
});
export async function createIssue(input: unknown): Promise<ArchResult> {
  try {
    const ctx = await ensure('architecture.manage');
    const d = issueSchema.parse(input);
    const issue = await prisma.issueLog.create({
      data: { title: d.title, description: d.description || null, severity: d.severity, projectId: d.projectId || null, raisedById: ctx.user.id, assignedToId: d.assignedToId || null },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'IssueLog', entityId: issue.id, summary: `Logged issue ${d.title}` });
    revalidatePath('/architecture');
    return { ok: true, id: issue.id };
  } catch (err) { return toActionError(err); }
}

export async function updateIssueStatus(id: string, status: IssueStatus): Promise<ArchResult> {
  try {
    const ctx = await ensure('architecture.manage');
    await prisma.issueLog.update({ where: { id }, data: { status, resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? new Date() : null } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'IssueLog', entityId: id, summary: `Status → ${status}` });
    revalidatePath('/architecture');
    return { ok: true, id };
  } catch (err) { return toActionError(err); }
}

export async function createConsultant(input: unknown): Promise<ArchResult> {
  try {
    const ctx = await ensure('architecture.manage');
    const d = z.object({ name: z.string().min(2), firm: z.string().optional(), discipline: z.string().optional(), email: z.string().email().optional().or(z.literal('')) }).parse(input);
    const c = await prisma.consultant.create({ data: { name: d.name, firm: d.firm || null, discipline: d.discipline || null, email: d.email || null } });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'Consultant', entityId: c.id, summary: `Added consultant ${d.name}` });
    revalidatePath('/architecture');
    return { ok: true, id: c.id };
  } catch (err) { return toActionError(err); }
}
