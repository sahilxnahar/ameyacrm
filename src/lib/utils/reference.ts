import { prisma } from '@/lib/db/prisma';
import { nextSequence } from '@/lib/db/sequence';

type Prefix = 'TSK' | 'LEAD' | 'MR' | 'BKG' | 'LSE' | 'MNT' | 'RFI';

const BASE: Record<Prefix, number> = { TSK: 1000, LEAD: 2000, MR: 3000, BKG: 4000, LSE: 5000, MNT: 6000, RFI: 7000 };

/**
 * Generate a human-friendly, monotonic reference like TSK-1042 / LEAD-2481.
 *
 * Backed by an atomic counter rather than `count() + 1`.
 *
 * The old approach lost enquiries. `reference` is unique, so two website
 * submissions landing in the same instant both computed LEAD-2481; the second
 * insert died on the unique index and — because nothing caught it — the visitor
 * saw a failure and their enquiry was never stored. Counting rows is also wrong
 * after any delete: the count drops and the next reference collides with one
 * already issued.
 *
 * The counter is seeded on first use from the highest reference in the table,
 * so numbering carries on from where it is rather than restarting.
 */
export async function nextReference(prefix: Prefix): Promise<string> {
  const key = `ref:${prefix}`;
  const start = await seedFromExisting(prefix, key);
  return `${prefix}-${await nextSequence(key, prisma, start)}`;
}

/**
 * Make sure the counter starts above whatever is already in use.
 *
 * Runs once per prefix: after the counter row exists, `nextSequence` ignores the
 * start value, so this lookup costs nothing on subsequent calls.
 */
async function seedFromExisting(prefix: Prefix, key: string): Promise<number> {
  const existing = await prisma.numberSequence.findUnique({ where: { key }, select: { value: true } }).catch(() => null);
  if (existing) return existing.value;

  // Parse the numeric part of every existing reference and take the highest.
  // Done in JS rather than ORDER BY, because ordering the text would rank
  // LEAD-9999 above LEAD-10000.
  let max = BASE[prefix];
  for (const ref of await currentReferences(prefix)) {
    const n = Number(String(ref).split('-')[1]?.replace(/\D/g, '') ?? '');
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

async function currentReferences(prefix: Prefix): Promise<string[]> {
  const pick = (rows: Array<{ reference: string | null }>) =>
    rows.map((r) => r.reference).filter((r): r is string => !!r);
  const where = { reference: { startsWith: `${prefix}-` } };
  const opts = { select: { reference: true }, where, take: 5000 };
  try {
    switch (prefix) {
      case 'TSK': return pick(await prisma.task.findMany(opts));
      case 'LEAD': return pick(await prisma.lead.findMany(opts));
      case 'MR': return pick(await prisma.materialRequest.findMany(opts));
      case 'BKG': return pick(await prisma.booking.findMany(opts));
      case 'LSE': return pick(await prisma.lease.findMany(opts));
      case 'MNT': return pick(await prisma.maintenanceRequest.findMany(opts));
      // RFI names its reference column `number`, not `reference`.
      case 'RFI': return (await prisma.rFI.findMany({
        select: { number: true }, where: { number: { startsWith: 'RFI-' } }, take: 5000,
      })).map((r) => r.number);
      default: return [];
    }
  } catch {
    // A table absent from this deployment must not stop a reference being
    // issued — the counter simply starts at the base.
    return [];
  }
}

export function docNumber(prefix: 'INV' | 'PO' | 'BILL', seq: number): string {
  return `${prefix}-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;
}
