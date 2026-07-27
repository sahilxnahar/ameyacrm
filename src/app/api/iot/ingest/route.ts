import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 20;

/** Unified IoT ingest — a device posts a reading; auto-registers the asset by serial. */
export async function POST(req: NextRequest) {
  const key = req.headers.get('x-iot-key') || req.nextUrl.searchParams.get('key') || '';
  if (!env.IOT_INGEST_SECRET || key !== env.IOT_INGEST_SECRET) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const serial = String(body.serialNumber ?? body.serial ?? '').trim();
  const metric = String(body.metric ?? '').trim();
  const value = Number(body.value);
  if (!serial || !metric || !Number.isFinite(value)) return NextResponse.json({ error: 'serialNumber, metric and numeric value are required' }, { status: 400 });

  const asset = await prisma.asset.upsert({
    where: { serialNumber: serial },
    update: {},
    create: { serialNumber: serial, name: String(body.name ?? serial), kind: String(body.kind ?? 'SENSOR'), projectId: body.projectId ? String(body.projectId) : null },
  });
  await prisma.iotReading.create({ data: { assetId: asset.id, metric, value, rawPayload: body as never } });
  return NextResponse.json({ ok: true, assetId: asset.id }, { status: 201 });
}
