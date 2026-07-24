import 'server-only';
import { prisma } from '@/lib/db/prisma';
import type { ParkingData, ParkingSlotRow, ParkingLevel, UnitLite } from '@/lib/parking/types';

export { PARKING_TYPES, PARKING_STATUSES } from '@/lib/parking/types';
export type { ParkingData, ParkingSlotRow, ParkingLevel, UnitLite } from '@/lib/parking/types';

export async function getParkingData(projectId?: string | null): Promise<ParkingData> {
  const projects = await prisma.project.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } });
  const pid = projectId ?? projects[0]?.id ?? null;

  const [slots, units] = await Promise.all([
    prisma.parkingSlot.findMany({
      where: pid ? { projectId: pid } : {},
      orderBy: [{ level: 'asc' }, { code: 'asc' }],
      take: 5000,
    }),
    pid
      ? prisma.unit.findMany({ where: { projectId: pid }, orderBy: { code: 'asc' }, select: { id: true, code: true, tower: true, floor: true, typology: true, status: true }, take: 5000 })
      : Promise.resolve([] as UnitLite[]),
  ]);

  const unitCodeById = new Map(units.map((u) => [u.id, u.code]));

  const byLevel = new Map<string, ParkingSlotRow[]>();
  let available = 0, assigned = 0, blocked = 0;
  const typeCount = new Map<string, number>();
  for (const s of slots) {
    const level = s.level?.trim() || 'Unassigned level';
    const row: ParkingSlotRow = {
      id: s.id, code: s.code, level, type: s.type, status: s.status,
      unitId: s.unitId, unitCode: s.unitId ? unitCodeById.get(s.unitId) ?? '(other project)' : null,
      bookingId: s.bookingId, notes: s.notes,
    };
    const arr = byLevel.get(level) ?? []; arr.push(row); byLevel.set(level, arr);
    if (s.status === 'Assigned') assigned++; else if (s.status === 'Blocked') blocked++; else available++;
    typeCount.set(s.type, (typeCount.get(s.type) ?? 0) + 1);
  }
  const levels: ParkingLevel[] = [...byLevel.entries()].map(([level, ss]) => ({ level, slots: ss }));

  return {
    projects,
    projectId: pid,
    levels,
    units: units as UnitLite[],
    totals: {
      total: slots.length, available, assigned, blocked,
      byType: [...typeCount.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    },
  };
}
