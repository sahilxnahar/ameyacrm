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

  /*
   * Take the true maximum, in SQL.
   *
   * This used to read `take: 5000` with NO orderBy and compute the max in
   * JavaScript over whatever arbitrary slice came back. Above five thousand
   * rows the seed could land BELOW the real maximum — and every one of these
   * columns is @unique, so the next few issues died on the index. Per this
   * file's own docstring: "the visitor saw a failure and their enquiry was
   * never stored."
   *
   * Casting the numeric part and taking MAX() is exact at any table size and
   * costs one query. `voucher-number.ts` has always done it this way; the two
   * files simply disagreed. Ordering the text is still wrong — LEAD-9999 sorts
   * above LEAD-10000 — which is why this casts to bigint rather than using
   * ORDER BY on the string.
   */
  return (await maxReferenceNumber(prefix)) ?? BASE[prefix];
}

/** The highest numeric suffix in use for this prefix, straight from Postgres. */
async function maxReferenceNumber(prefix: Prefix): Promise<number | null> {
  const table = TABLE[prefix];
  if (!table) return null;
  const column = prefix === 'RFI' ? 'number' : 'reference';
  try {
    /*
     * The table and column are interpolated because a SQL identifier cannot be
     * a bound parameter. Both come from the hardcoded TABLE map and a two-way
     * literal below — never from a request — and the only value that varies,
     * the LIKE pattern, IS parameterised as $1.
     */
    // eslint-disable-next-line no-restricted-properties
    const rows = await prisma.$queryRawUnsafe<Array<{ max: bigint | number | null }>>(
      `SELECT MAX(NULLIF(regexp_replace(SPLIT_PART("${column}", '-', 2), '\\D', '', 'g'), '')::bigint) AS max
         FROM "${table}"
        WHERE "${column}" LIKE $1`,
      `${prefix}-%`,
    );
    const v = rows[0]?.max;
    if (v == null) return null;
    const n = typeof v === 'bigint' ? Number(v) : v;
    return Number.isFinite(n) ? Math.max(n, BASE[prefix]) : null;
  } catch {
    // A table absent from this deployment must not stop a reference being
    // issued — fall back to the base rather than failing the create.
    return null;
  }
}

/**
 * Prefix → table. Hardcoded, never built from input: these names are
 * interpolated into the query above because a table identifier cannot be a
 * bound parameter.
 */
const TABLE: Record<Prefix, string | null> = {
  TSK: 'Task', LEAD: 'Lead', MR: 'MaterialRequest', BKG: 'Booking',
  LSE: 'Lease', MNT: 'MaintenanceRequest', RFI: 'RFI',
};

export function docNumber(prefix: 'INV' | 'PO' | 'BILL', seq: number): string {
  return `${prefix}-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;
}
