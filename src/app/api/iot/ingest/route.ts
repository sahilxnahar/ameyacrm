import { NextResponse, type NextRequest } from 'next/server';
import { requireHeaderSecret } from '@/lib/security/require-secret';
import { prisma } from '@/lib/db/prisma';
import { env } from '@/config/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 20;

/** Unified IoT ingest — a device posts a reading; auto-registers the asset by serial. */
export async function POST(req: NextRequest) {
  const denied = requireHeaderSecret(req, 'x-iot-key', env.IOT_INGEST_SECRET);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }); }

  const serial = String(body.serialNumber ?? body.serial ?? '').trim();
  const metric = String(body.metric ?? '').trim();
  const value = Number(body.value);
  if (!serial || !metric || !Number.isFinite(value)) return NextResponse.json({ error: 'serialNumber, metric and numeric value are required' }, { status: 400 });

  // Only bind to a project that actually exists (F-32: no cross-project poisoning
  // from an attacker-supplied projectId on a leaked device key).
  let projectId: string | null = null;
  if (body.projectId) {
    const pid = String(body.projectId);
    const proj = await prisma.project.findUnique({ where: { id: pid }, select: { id: true } });
    if (!proj) return NextResponse.json({ error: 'unknown projectId' }, { status: 400 });
    projectId = proj.id;
  }

  const asset = await prisma.asset.upsert({
    where: { serialNumber: serial },
    update: {},
    create: { serialNumber: serial, name: String(body.name ?? serial), kind: String(body.kind ?? 'SENSOR'), projectId },
  });
  await prisma.iotReading.create({ data: { assetId: asset.id, metric, value, rawPayload: body as never } });
  return NextResponse.json({ ok: true, assetId: asset.id }, { status: 201 });
}
