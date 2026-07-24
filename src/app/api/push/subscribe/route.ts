import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser } from '@/lib/auth/current-user';
import { env } from '@/config/env';

export async function GET() {
  return NextResponse.json({ key: env.VAPID_PUBLIC_KEY ?? null });
}

export async function POST(req: NextRequest) {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json();
  const { endpoint, keys } = body ?? {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh: keys.p256dh, auth: keys.auth, userId: ctx.user.id },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth, userId: ctx.user.id, userAgent: req.headers.get('user-agent') ?? undefined },
  });
  return NextResponse.json({ ok: true });
}
