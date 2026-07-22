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
  const deviceIds = devices.map((d) => d.id);

  // The latest reading per (device, metric) in ONE query, using DISTINCT on the
  // desc-by-time order — instead of a findMany per device (the old N+1 that ran
  // up to 200 queries to paint one dashboard).
  const latestReadings = deviceIds.length
    ? await prisma.siteReading.findMany({
        where: { deviceId: { in: deviceIds } },
        orderBy: { recordedAt: 'desc' },
        distinct: ['deviceId', 'metric'],
        take: 2000,
      })
    : [];
  const latestByDevice = new Map<string, DeviceReading[]>();
  for (const r of latestReadings) {
    const arr = latestByDevice.get(r.deviceId) ?? [];
    arr.push({ metric: r.metric, value: r.value, unit: r.unit, recordedAt: r.recordedAt });
    latestByDevice.set(r.deviceId, arr);
  }

  const deviceRows: TelemetryDeviceRow[] = devices.map((d) => ({
    id: d.id, name: d.name, kind: d.kind, location: d.location,
    status: deviceStatus(d.lastSeenAt, now), lastSeenAt: d.lastSeenAt,
    latest: latestByDevice.get(d.id) ?? [],
  }));

  return {
    devices: deviceRows,
    recent: recent.map((r) => ({ id: r.id, deviceName: nameById.get(r.deviceId) ?? 'Unknown device', metric: r.metric, value: r.value, unit: r.unit, recordedAt: r.recordedAt })),
    counts: { devices: devices.length, online: deviceRows.filter((d) => d.status === 'online').length, readings: readingCount },
  };
}
