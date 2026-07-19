import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { getObjectStream, signedDownloadUrl } from '@/lib/storage/storage';
import { writeAudit } from '@/lib/audit/log';

/** Secure, audited file download. Streams local objects; redirects to a signed
 *  URL for S3. Requires `document.download` permission. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!can(ctx.permissions, 'document.download')) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { id } = await params;
  const file = await prisma.fileObject.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await writeAudit({ actorId: ctx.user.id, action: 'DOWNLOAD', entityType: 'FileObject', entityId: file.id, summary: `Downloaded ${file.originalName}` });

  const signed = await signedDownloadUrl(file.key);
  if (signed) return NextResponse.redirect(signed);

  const { body } = await getObjectStream(file.key);
  return new NextResponse(body as BodyInit, {
    headers: {
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(file.originalName)}"`,
      'Content-Length': String(file.size),
    },
  });
}
