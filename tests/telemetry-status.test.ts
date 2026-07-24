import { describe, it, expect } from 'vitest';
import { deviceStatus, formatReading, metricLabel, statusLabel } from '@/lib/telemetry/status';

const now = new Date('2026-07-21T12:00:00Z');

describe('telemetry status (31-plan #27)', () => {
  it('is online when it reported in the last 10 minutes', () => {
    expect(deviceStatus(new Date('2026-07-21T11:55:00Z'), now)).toBe('online');
  });
  it('is idle between 10 and 60 minutes', () => {
    expect(deviceStatus(new Date('2026-07-21T11:20:00Z'), now)).toBe('idle');
  });
  it('is offline after an hour', () => {
    expect(deviceStatus(new Date('2026-07-21T10:00:00Z'), now)).toBe('offline');
  });
  it('is "never" with no reading', () => {
    expect(deviceStatus(null, now)).toBe('never');
    expect(statusLabel(deviceStatus(null, now))).toBe('No data yet');
  });
  it('formats a reading with its unit', () => {
    expect(formatReading(31.436, '°C')).toBe('31.44 °C');
    expect(formatReading(50)).toBe('50');
  });
  it('labels known metrics and title-cases unknown ones', () => {
    expect(metricLabel('dust')).toBe('Dust (PM)');
    expect(metricLabel('methane')).toBe('Methane');
  });
});
