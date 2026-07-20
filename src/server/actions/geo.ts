'use server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { ensure, toActionError } from '@/server/actions/_helpers';

export type GeoResult = { ok: true; found?: number } | { error: string };

/**
 * Look up coordinates with OpenStreetMap's Nominatim — free, no key, no card.
 * Their usage policy asks for one request per second and a real User-Agent,
 * both of which we honour.
 */
async function geocode(query: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'AmeyaHeightsCRM/1.0 (crm@ameyaheights.com)' } });
    if (!res.ok) return null;
    const j = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!j.length) return null;
    return { lat: Number(j[0].lat), lon: Number(j[0].lon) };
  } catch { return null; }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fill in coordinates for projects that have an address but no pin yet. */
export async function geocodeProjects(): Promise<GeoResult> {
  try {
    await ensure('admin.setting.manage');
    const projects = await prisma.project.findMany({
      where: { latitude: null, OR: [{ address: { not: null } }, { city: { not: '' } }] },
      select: { id: true, name: true, address: true, city: true },
      take: 25,
    });
    let found = 0;
    for (const p of projects) {
      const hit = await geocode([p.address, p.city, 'India'].filter(Boolean).join(', '));
      if (hit) {
        await prisma.project.update({ where: { id: p.id }, data: { latitude: hit.lat, longitude: hit.lon } });
        found++;
      }
      await sleep(1100);
    }
    revalidatePath('/map');
    return { ok: true, found };
  } catch (err) { return toActionError(err); }
}

/** Same for leads that have a locality typed in but no pin. */
export async function geocodeLeads(): Promise<GeoResult> {
  try {
    await ensure('lead.view');
    const leads = await prisma.lead.findMany({
      where: { deletedAt: null, latitude: null, locality: { not: null } },
      select: { id: true, locality: true },
      take: 25,
    });
    let found = 0;
    for (const l of leads) {
      const hit = await geocode(`${l.locality}, Bangalore, India`);
      if (hit) {
        await prisma.lead.update({ where: { id: l.id }, data: { latitude: hit.lat, longitude: hit.lon } });
        found++;
      }
      await sleep(1100);
    }
    revalidatePath('/map');
    return { ok: true, found };
  } catch (err) { return toActionError(err); }
}

export async function setProjectLocation(projectId: string, latitude: number, longitude: number): Promise<GeoResult> {
  try {
    await ensure('admin.setting.manage');
    await prisma.project.update({ where: { id: projectId }, data: { latitude, longitude } });
    revalidatePath('/map');
    return { ok: true };
  } catch (err) { return toActionError(err); }
}
