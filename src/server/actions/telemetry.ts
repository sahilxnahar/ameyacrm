'use server';
import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from './_helpers';

export type TelemetryResult = { ok: true; message: string; deviceKey?: string } | { error: string };

const opt = (s: string) => { const t = (s ?? '').trim(); return t === '' ? null : t; };
const newKey = () => `dev_${randomBytes(20).toString('base64url')}`;

/** Register a device. Returns its secret key once — shown to the person to paste into the device. */
export async function registerTelemetryDevice(v: Record<string, string>): Promise<TelemetryResult> {
  try {
    const ctx = await ensure('telemetry.manage');
    const name = z.string().trim().min(2, 'Name the device.').parse(v.name ?? '');
    const deviceKey = newKey();
    const d = await prisma.telemetryDevice.create({
      data: {
        name,
        deviceKey,
        kind: (['sensor', 'tracker', 'drone', 'meter'].includes(v.kind ?? '') ? v.kind : 'sensor'),
        projectId: opt(v.projectId ?? ''),
        location: opt(v.location ?? ''),
        createdById: ctx.user.id,
      },
      select: { id: true },
    });
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'TelemetryDevice', entityId: d.id, summary: `Registered device "${name}"` });
    revalidatePath('/telemetry');
    return { ok: true, message: 'Device registered.', deviceKey };
  } catch (e) { return toActionError(e); }
}

/** Rotate a device's key — the old one stops working immediately. */
export async function rotateDeviceKey(id: string): Promise<TelemetryResult> {
  try {
    const ctx = await ensure('telemetry.manage');
    const deviceKey = newKey();
    await prisma.telemetryDevice.update({ where: { id }, data: { deviceKey } });
    await writeAudit({ actorId: ctx.user.id, action: 'UPDATE', entityType: 'TelemetryDevice', entityId: id, summary: 'Rotated device key' });
    revalidatePath('/telemetry');
    return { ok: true, message: 'Key rotated.', deviceKey };
  } catch (e) { return toActionError(e); }
}

/** Record a reading by hand — so the dashboard can be verified before any hardware exists. */
export async function recordManualReading(v: Record<string, string>): Promise<TelemetryResult> {
  try {
    const ctx = await ensure('telemetry.manage');
    const deviceId = (v.deviceId ?? '').trim();
    const device = await prisma.telemetryDevice.findUnique({ where: { id: deviceId }, select: { id: true, projectId: true } });
    if (!device) return { error: 'Unknown device.' };
    const metric = z.string().trim().min(1, 'Give the metric a name.').parse(v.metric ?? '');
    const value = Number(v.value);
    if (!Number.isFinite(value)) return { error: 'Enter a number for the value.' };
    await prisma.$transaction([
      prisma.siteReading.create({ data: { deviceId: device.id, projectId: device.projectId, metric, value, unit: opt(v.unit ?? '') } }),
      prisma.telemetryDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } }),
    ]);
    await writeAudit({ actorId: ctx.user.id, action: 'CREATE', entityType: 'SiteReading', entityId: device.id, summary: `Manual reading ${metric}=${value}` });
    revalidatePath('/telemetry');
    return { ok: true, message: 'Reading recorded.' };
  } catch (e) { return toActionError(e); }
}
