import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

/**
 * Ingestion endpoint for site telemetry (31-plan #27). A real sensor, tracker,
 * meter or drone POSTs its readings here, authenticated by its own `deviceKey` —
 * no user session. This is the "ready for hardware" half: the moment a device
 * exists, it points here and the dashboard fills in.
 *
 * Body: { deviceKey: string, readings: [{ metric, value, unit?, lat?, lng?, recordedAt? }] }
 *   (a single { metric, value, ... } is also accepted).
 * Always answers JSON; never throws.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const deviceKey: unknown = body?.deviceKey;
    if (typeof deviceKey !== 'string' || !deviceKey) {
      return NextResponse.json({ ok: false, error: 'deviceKey required' }, { status: 401 });
    }
    const device = await prisma.telemetryDevice.findUnique({ where: { deviceKey } });
    if (!device || !device.isActive) {
      return NextResponse.json({ ok: false, error: 'Unknown or inactive device' }, { status: 401 });
    }

    const raw: unknown[] = Array.isArray(body?.readings) ? body.readings : body?.metric != null ? [body] : [];
    const rows = raw
      .map((r) => r as Record<string, unknown>)
      .filter((r) => typeof r.metric === 'string' && Number.isFinite(Number(r.value)))
      .slice(0, 500)
      .map((r) => ({
        deviceId: device.id,
        projectId: device.projectId,
        metric: String(r.metric).slice(0, 40),
        value: Number(r.value),
        unit: typeof r.unit === 'string' ? r.unit.slice(0, 16) : null,
        lat: Number.isFinite(Number(r.lat)) ? Number(r.lat) : null,
        lng: Number.isFinite(Number(r.lng)) ? Number(r.lng) : null,
        recordedAt: r.recordedAt ? new Date(String(r.recordedAt)) : new Date(),
      }));

    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: 'No valid readings' }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.siteReading.createMany({ data: rows }),
      prisma.telemetryDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } }),
    ]);

    return NextResponse.json({ ok: true, inserted: rows.length });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not record readings' }, { status: 500 });
  }
}
