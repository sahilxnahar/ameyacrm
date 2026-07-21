import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';
import { putObject } from '@/lib/storage/storage';
import { inferMimeType } from '@/lib/files/mime';
import { resolvePermissions } from '@/lib/rbac/can';
import { getFolderTree } from '@/server/services/folder-access-service';
import { writeAudit } from '@/lib/audit/log';
import { logError } from '@/lib/monitoring/log-error';
import type { AuthContext } from '@/types/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const schema = z.object({
  from: z.string().min(3),
  subject: z.string().max(300).optional().or(z.literal('')),
  attachments: z.array(z.object({
    filename: z.string().min(1).max(255),
    mimeType: z.string().max(120).optional().or(z.literal('')),
    data: z.string().min(10),                   // base64
  })).min(1).max(10),
});

/**
 * File attachments that arrive by email.
 *
 * Anyone on the team forwards a bill to the CRM mailbox with the department in
 * the subject — "Billing", "Architecture" — and it lands in that folder. The
 * sender is identified by their email address and only their own folders are
 * ever considered, so this grants nobody anything they did not already have.
 */
export async function POST(req: NextRequest) {
  const secret = env.INGEST_SECRET;
  const key = req.nextUrl.searchParams.get('key') ?? req.headers.get('x-ingest-key');
  if (secret && key !== secret) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const d = schema.parse(await req.json());
    const address = extractAddress(d.from);

    const user = await prisma.user.findFirst({
      where: { email: address, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, name: true, email: true, username: true, role: true, status: true, departmentId: true },
    });
    if (!user) {
      return NextResponse.json({ ok: true, stored: 0, skipped: d.attachments.length, reason: `${address} is not an active CRM user` });
    }

    const permissions = await resolvePermissions({ id: user.id, role: user.role });
    const ctx = { user, permissions } as unknown as AuthContext;

    const folderId = await pickFolder(ctx, d.subject ?? '', user.id);

    let stored = 0;
    const failed: string[] = [];
    for (const a of d.attachments) {
      try {
        const buffer = Buffer.from(a.data, 'base64');
        if (!buffer.length || buffer.length > 25 * 1024 * 1024) { failed.push(a.filename); continue; }

        const mimeType = inferMimeType(a.mimeType ?? '', a.filename);
        const objectKey = `email/${user.id}/${Date.now()}-${a.filename.replace(/[^\w.\-]/g, '_')}`;
        const put = await putObject(objectKey, buffer, mimeType);

        const fileObj = await prisma.fileObject.create({
          data: {
            key: put.key, bucket: put.bucket, originalName: a.filename,
            mimeType, size: put.size, uploadedById: user.id,
          },
        });
        await prisma.document.create({
          data: {
            title: a.filename.slice(0, 200), folderId, ownerId: user.id, currentVersion: 1,
            versions: { create: { version: 1, fileId: fileObj.id, createdById: user.id } },
          },
        });
        stored++;

        // Summary and Drive mirror happen afterwards, so a big batch does not
        // hold the connector's request open.
        void import('@/server/services/file-sync-service')
          .then((m) => m.processFile(fileObj.id))
          .catch(() => undefined);
      } catch {
        failed.push(a.filename);
      }
    }

    const folder = await prisma.folder.findUnique({ where: { id: folderId }, select: { name: true } });
    if (stored) {
      await writeAudit({
        actorId: user.id, action: 'CREATE', entityType: 'Document',
        summary: `${stored} file${stored === 1 ? '' : 's'} filed from an email into ${folder?.name ?? 'a folder'}`,
      });
    }
    return NextResponse.json({ ok: true, stored, failed, folder: folder?.name ?? null, by: user.name });
  } catch (e) {
    await logError(e, { path: '/api/ingest/email-attachment' });
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 400 });
  }
}

/** "Sahil <sahil@x.com>" → "sahil@x.com" */
function extractAddress(raw: string): string {
  const m = raw.match(/<([^>]+)>/);
  return (m?.[1] ?? raw).trim().toLowerCase();
}

/**
 * Match the subject to a folder this person may open. Falls back to a single
 * "From Email" folder so a vague subject never loses the attachment.
 */
async function pickFolder(ctx: AuthContext, subject: string, userId: string): Promise<string> {
  const tree = await getFolderTree(ctx);
  const open = tree.filter((f) => f.canOpen);
  const words = subject.toLowerCase();

  const hit =
    open.find((f) => words.includes(f.name.toLowerCase())) ??
    open.find((f) => f.name.toLowerCase().split(/\s+/).some((w) => w.length > 3 && words.includes(w)));
  if (hit) return hit.id;

  const existing = await prisma.folder.findFirst({ where: { name: 'From Email', parentId: null, deletedAt: null }, select: { id: true } });
  if (existing) return existing.id;
  const made = await prisma.folder.create({
    data: { name: 'From Email', parentId: null, createdById: userId, path: 'From Email', visibility: 'ORGANIZATION' },
    select: { id: true },
  });
  return made.id;
}
