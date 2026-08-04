import { NextResponse, type NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 20;

/** Razorpay webhook receiver — verifies the signature, parks a WebhookEvent, acks fast. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get('x-razorpay-signature') || '';
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'razorpay webhook not configured' }, { status: 503 });

  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: 'invalid signature' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = JSON.parse(raw) as Record<string, unknown>; } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const type = String(body.event ?? 'unknown');
  const entity = ((body.payload as Record<string, unknown> | undefined)?.payment as Record<string, unknown> | undefined)?.entity as Record<string, unknown> | undefined;
  const externalId = String(entity?.id ?? body.id ?? `${type}-${Date.now()}`);

  await prisma.webhookEvent.upsert({
    where: { provider_externalId: { provider: 'RAZORPAY', externalId } },
    update: {},
    create: { provider: 'RAZORPAY', externalId, type, payload: body as Prisma.InputJsonValue, status: 'PENDING' },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true });
}
