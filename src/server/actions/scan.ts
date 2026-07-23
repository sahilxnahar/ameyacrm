'use server';
import { prisma } from '@/lib/db/prisma';
import { ensure, toActionError } from './_helpers';

export interface ScanMatch {
  units: Array<{ id: string; code: string; tower: string | null; typology: string | null; status: string }>;
  slots: Array<{ id: string; code: string; level: string | null; status: string; unitId: string | null }>;
}

/** Look up a scanned code against unit codes and parking-slot codes. */
export async function resolveScannedCode(code: string): Promise<{ ok: true; data: ScanMatch } | { error: string }> {
  try {
    await ensure('booking.view');
    const trimmed = code.trim();
    if (!trimmed) return { ok: true, data: { units: [], slots: [] } };
    const [units, slots] = await Promise.all([
      prisma.unit.findMany({ where: { code: { equals: trimmed, mode: 'insensitive' } }, select: { id: true, code: true, tower: true, typology: true, status: true }, take: 5 }),
      prisma.parkingSlot.findMany({ where: { code: { equals: trimmed, mode: 'insensitive' } }, select: { id: true, code: true, level: true, status: true, unitId: true }, take: 5 }),
    ]);
    return { ok: true, data: { units, slots } };
  } catch (e) { return toActionError(e); }
}
