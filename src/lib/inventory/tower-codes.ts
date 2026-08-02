const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Unit code for a floor and a position on it — A-1203, or A-12C where the
 * developer numbers by letter.
 *
 * Pure and in its own module so it can be unit-tested: a 'use server' file may
 * only export async server actions, and a code generator that silently changes
 * shape is how a whole tower ends up mis-numbered.
 */
export function towerUnitCode(
  tower: string,
  floor: number,
  index: number,
  numbering: 'NUMERIC' | 'ALPHA',
  startAt: number,
): string {
  const suffix = numbering === 'ALPHA'
    ? (ALPHA[index] ?? String(index + 1))
    : String(startAt + index).padStart(2, '0');
  // Basements are written B1, B2 — never "-1", which would give "A--101".
  const level = floor < 0 ? `B${Math.abs(floor)}` : String(floor);
  return `${tower}-${level}${suffix}`;
}
