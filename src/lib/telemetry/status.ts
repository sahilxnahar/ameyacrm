/**
 * Telemetry helpers, kept pure so device online/offline logic and metric
 * formatting are one testable place — shared by the dashboard and the API.
 *
 * The software here is "ready for hardware": a real sensor, tracker or meter
 * POSTs readings to the ingestion endpoint, and these functions decide whether a
 * device is currently reporting and how to show what it sent.
 */
export type DeviceStatus = 'online' | 'idle' | 'offline' | 'never';

/** How a device is doing, from how long ago it last reported. */
export function deviceStatus(lastSeenAt: Date | string | null | undefined, now: Date): DeviceStatus {
  if (!lastSeenAt) return 'never';
  const seen = typeof lastSeenAt === 'string' ? new Date(lastSeenAt) : lastSeenAt;
  const mins = (now.getTime() - seen.getTime()) / 60000;
  if (!Number.isFinite(mins) || mins < 0) return 'idle';
  if (mins <= 10) return 'online';
  if (mins <= 60) return 'idle';
  return 'offline';
}

export function statusLabel(s: DeviceStatus): string {
  return s === 'online' ? 'Online' : s === 'idle' ? 'Idle' : s === 'offline' ? 'Offline' : 'No data yet';
}

/** A short human reading, e.g. `31.4 °C`. */
export function formatReading(value: number, unit?: string | null): string {
  const v = Math.round(value * 100) / 100;
  return unit ? `${v} ${unit}` : String(v);
}

/** The metrics the dashboard knows how to label; anything else shows raw. */
export const METRIC_LABELS: Record<string, string> = {
  temperature: 'Temperature',
  humidity: 'Humidity',
  dust: 'Dust (PM)',
  noise: 'Noise',
  vibration: 'Vibration',
  fuel: 'Fuel level',
  power: 'Power',
  water: 'Water level',
  location: 'Location',
};

export function metricLabel(metric: string): string {
  return METRIC_LABELS[metric] ?? metric.charAt(0).toUpperCase() + metric.slice(1);
}
