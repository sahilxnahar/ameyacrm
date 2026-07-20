import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getCurrentUser } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Issues short-lived client-upload tokens so the browser uploads DIRECTLY to Blob storage.
 * This bypasses the 4.5 MB serverless request limit — large drawings/PDFs upload fine.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const ctx = await getCurrentUser();
        if (!ctx) throw new Error('You must be signed in to upload.');
        if (!can(ctx.permissions, 'document.create')) throw new Error('You do not have permission to upload files.');
        return {
          addRandomSuffix: true,
          maximumSizeInBytes: 100 * 1024 * 1024, // 100 MB
          tokenPayload: JSON.stringify({ userId: ctx.user.id }),
        };
      },
      onUploadCompleted: async () => { /* the record is created by registerUploadedDocument() */ },
    });
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Upload failed' }, { status: 400 });
  }
}
