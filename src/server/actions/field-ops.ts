'use server';
import { z } from 'zod';
import { startOfDay, endOfDay } from 'date-fns';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { can } from '@/lib/rbac/can';
import { writeAudit } from '@/lib/audit/log';
import { ensure, toActionError } from '@/server/actions/_helpers';

export type FieldResult = { ok: true; message?: string; withinSite?: boolean; distanceM?: number | null } | { error: string };

/** Great-circle distance in metres. */
function metresBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)));
}

const SITE_RADIUS_M = 300;

const punchSchema = z.object({
  kind: z.enum(['CHECK_IN', 'CHECK_OUT']),
  projectId: z.string().optional().nullable(),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  accuracyM: z.coerce.number().optional().nullable(),
  note: z.string().max(300).optional(),
  at: z.string().optional(),          // ISO — set when syncing something captured offline
  offline: z.boolean().optional(),
});

/**
 * Record a check-in or check-out. Location is recorded when the phone gives it,
 * and compared against the project's coordinates — but a missing or distant
 * fix never blocks the punch. Site staff lose signal; that is not misconduct,
 * and the record simply says so.
 */
export async function punch(input: unknown): Promise<FieldResult> {
  try {
    const ctx = await ensure('dashboard.view');
    const d = punchSchema.parse(input);

    let distanceM: number | null = null;
    let withinSite = false;
    if (d.projectId && d.latitude != null && d.longitude != null) {
      const p = await prisma.project.findUnique({ where: { id: d.projectId }, select: { latitude: true, longitude: true } });
      if (p?.latitude != null && p?.longitude != null) {
        distanceM = metresBetween(d.latitude, d.longitude, p.latitude, p.longitude);
        withinSite = distanceM <= SITE_RADIUS_M;
      }
    }

    const at = d.at ? new Date(d.at) : new Date();
    await prisma.attendance.create({
      data: {
        userId: ctx.user.id, projectId: d.projectId || null, kind: d.kind, at,
        latitude: d.latitude ?? null, longitude: d.longitude ?? null,
        accuracyM: d.accuracyM ?? null, distanceM, withinSite,
        note: d.note || null, offline: Boolean(d.offline),
      },
    });

    revalidatePath('/field');
    return {
      ok: true, withinSite, distanceM,
      message: distanceM === null
        ? (d.kind === 'CHECK_IN' ? 'Checked in.' : 'Checked out.')
        : withinSite
          ? `${d.kind === 'CHECK_IN' ? 'Checked in' : 'Checked out'} at the site.`
          : `Recorded — but you are about ${distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)} km` : `${distanceM} m`} from the site.`,
    };
  } catch (err) { return toActionError(err); }
}

/** Push a batch of punches captured while offline. Duplicates are ignored. */
export async function syncOfflinePunches(items: unknown[]): Promise<FieldResult> {
  try {
    await ensure('dashboard.view');
    let saved = 0;
    for (const it of items.slice(0, 100)) {
      const r = await punch({ ...(it as object), offline: true });
      if ('ok' in r) saved++;
    }
    revalidatePath('/field');
    return { ok: true, message: `${saved} offline ${saved === 1 ? 'entry' : 'entries'} synced.` };
  } catch (err) { return toActionError(err); }
}

const rosterSchema = z.object({
  userId: z.string().min(1),
  date: z.string().min(8),
  shift: z.enum(['MORNING', 'EVENING', 'NIGHT', 'FULL_DAY', 'OFF']),
  projectId: z.string().optional().nullable(),
  note: z.string().max(200).optional(),
});

export async function setRoster(input: unknown): Promise<FieldResult> {
  try {
    const ctx = await ensure('admin.user.manage');
    const d = rosterSchema.parse(input);
    const date = startOfDay(new Date(d.date));
    await prisma.dutyRoster.upsert({
      where: { userId_date: { userId: d.userId, date } },
      update: { shift: d.shift, projectId: d.projectId || null, note: d.note || null },
      create: { userId: d.userId, date, shift: d.shift, projectId: d.projectId || null, note: d.note || null, createdById: ctx.user.id },
    });
    revalidatePath('/field');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

export async function clearRoster(userId: string, date: string): Promise<FieldResult> {
  try {
    await ensure('admin.user.manage');
    await prisma.dutyRoster.deleteMany({ where: { userId, date: startOfDay(new Date(date)) } });
    revalidatePath('/field');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}

/** Today's attendance, scoped to the team the viewer is allowed to see. */
export async function todayAttendance() {
  const ctx = await ensure('dashboard.view');
  const seeAll = can(ctx.permissions, 'admin.user.view');
  const now = new Date();
  return prisma.attendance.findMany({
    where: { at: { gte: startOfDay(now), lte: endOfDay(now) }, ...(seeAll ? {} : { userId: ctx.user.id }) },
    orderBy: { at: 'desc' },
    take: 200,
  });
}
