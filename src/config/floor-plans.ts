/**
 * Plan types. Kept out of the actions file because a `'use server'` module may
 * only export async functions.
 */
export const PLAN_KINDS = ['UNIT', 'FLOOR', 'TOWER', 'MASTER', 'AMENITY'] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

export const PLAN_KIND_LABEL: Record<PlanKind, string> = {
  UNIT: 'Unit plan',
  FLOOR: 'Floor plan',
  TOWER: 'Tower elevation',
  MASTER: 'Site master plan',
  AMENITY: 'Amenities',
};
