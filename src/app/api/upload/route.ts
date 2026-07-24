import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { getCurrentUser } from '@/lib/auth/current-user';
import { can } from '@/lib/rbac/can';
import { checkRate, callerIp } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Issues short-lived client-upload tokens so the browser uploads DIRECTLY to Blob storage.
 * This bypasses the 4.5 MB serverless request limit — large drawings/PDFs upload fine.
 */
export async function POST(request: Request): Promise<NextResponse> {
  // Cap how fast one source can mint upload tokens. 120/min is far above any real
  // person dragging in files, but stops the endpoint being hammered.
  const ip = await callerIp();
  const rate = await checkRate(`upload-token:${ip}`, 120, 60);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many uploads at once. Please wait a moment.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } });
  }
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const ctx = await getCurrentUser();
        if (!ctx) throw new Error('You must be signed in to upload.');

        // A profile photo is not a "document" — every signed-in person may set
        // their own avatar, even without document/marketing rights. The client
        // flags these with { purpose: 'avatar' }; we then cap them to images and
        // a small size so this relaxed path can't be used to smuggle big files.
        let purpose: string | undefined;
        try { purpose = clientPayload ? (JSON.parse(clientPayload) as { purpose?: string }).purpose : undefined; } catch { /* ignore */ }
        if (purpose === 'avatar') {
          return {
            addRandomSuffix: true,
            allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
            maximumSizeInBytes: 8 * 1024 * 1024, // 8 MB — plenty for a photo
            tokenPayload: JSON.stringify({ userId: ctx.user.id, purpose: 'avatar' }),
          };
        }

        // A chat attachment is not a "document" either — anyone who can use the
        // team chat may attach a file of ANY type (image, video, PDF, zip, …),
        // without needing document/marketing rights. No content-type restriction;
        // a generous size cap so short videos work, still bounded against abuse.
        if (purpose === 'chat') {
          return {
            addRandomSuffix: true,
            maximumSizeInBytes: 200 * 1024 * 1024, // 200 MB — room for a short video
            tokenPayload: JSON.stringify({ userId: ctx.user.id, purpose: 'chat' }),
          };
        }

        if (!can(ctx.permissions, 'document.create') && !can(ctx.permissions, 'marketing.manage')) throw new Error('You do not have permission to upload files.');
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
