import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

// 1×1 transparent GIF.
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

/**
 * Open tracking. Always returns the pixel, whatever happens — a tracking
 * failure must never show a broken image in someone's inbox.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    await prisma.mailThreadMessage.updateMany({
      where: { trackToken: token },
      data: { openCount: { increment: 1 }, openedAt: new Date() },
    });
  } catch { /* ignore */ }

  return new NextResponse(PIXEL as unknown as BodyInit, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Content-Length': String(PIXEL.length),
    },
  });
}
