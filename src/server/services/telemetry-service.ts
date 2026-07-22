import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { deviceStatus, type DeviceStatus } from '@/lib/telemetry/status';

export interface DeviceReading { metric: string; value: number; unit: string | null; recordedAt: Date }
export interface TelemetryDeviceRow {
  id: string; name: string; kind: string; location: string | null;
  status: DeviceStatus; lastSeenAt: Date | null; latest: DeviceReading[];
}
export interface TelemetryOverview {
  devices: TelemetryDeviceRow[];
  recent: Array<{ id: string; deviceName: string; metric: string; value: number; unit: string | null; recordedAt: Date }>;
  counts: { devices: number; online: number; readings: number };
}

/**
 * Everything the site-telemetry dashboard shows. The readings come in through the
 * ingestion endpoint from real devices; this reads them back with each device's
 * live status and its latest value per metric.
 */
export async function getTelemetryOverview(): Promise<TelemetryOverview> {
  const now = new Date();
  const [devices, recent, readingCount] = await Promise.all([
    prisma.telemetryDevice.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.siteReading.findMany({ orderBy: { recordedAt: 'desc' }, take: 60 }),
    prisma.siteReading.count(),
  ]);
  const nameById = new Map(devices.map((d) => [d.id, d.name]));

  const deviceRows: TelemetryDeviceRow[] = await Promise.all(
    devices.map(async (d) => {
      const readings = await prisma.siteReading.findMany({ where: { deviceId: d.id }, orderBy: { recordedAt: 'desc' }, take: 50 });
      const latest = new Map<string, DeviceReading>();
      for (const r of readings) if (!latest.has(r.metric)) latest.set(r.metric, { metric: r.metric, value: r.value, unit: r.unit, recordedAt: r.recordedAt });
      return { id: d.id, name: d.name, kind: d.kind, location: d.location, status: deviceStatus(d.lastSeenAt, now), lastSeenAt: d.lastSeenAt, latest: [...latest.values()] };
    }),
  );

  return {
    devices: deviceRows,
    recent: recent.map((r) => ({ id: r.id, deviceName: nameById.get(r.deviceId) ?? 'Unknown device', metric: r.metric, value: r.value, unit: r.unit, recordedAt: r.recordedAt })),
    counts: { devices: devices.length, online: deviceRows.filter((d) => d.status === 'online').length, readings: readingCount },
  };
}
