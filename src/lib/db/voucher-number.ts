import 'server-only';
import { prisma } from '@/lib/db/prisma';

/**
 * One allocator for the whole CP-/CR- series.
 *
 * Six places create vouchers and they used to allocate numbers two different
 * ways: an atomic `NumberSequence` counter, and `MAX(number)` read as text.
 * `Voucher.number` is unique, so mixing them is not a style problem — it is a
 * collision. A books with CP-1001…CP-1400 from an import plus a counter still
 * sitting at 1000 means the next RA-bill settlement fails outright, and the
 * reverse leaves the MAX-based callers re-issuing numbers the counter has
 * already handed out.
 *
 * The counter is therefore seeded, on first use, from the highest number the
 * series actually contains — read as an integer, not as text, so CP-10000 sorts
 * above CP-9999 rather than below it.
 */
export async function nextVoucherNumber(prefix: string): Promise<string> {
  const key = `voucher:${prefix}`;
  const like = `${prefix}-%`;
  const pattern = `^${prefix}-[0-9]+$`;

  // Seeding scans the existing series, so it is done once — not on every row of
  // a thousand-row import, which is what putting the subquery in the INSERT
  // VALUES would do (Postgres evaluates it before it discovers the conflict).
  const seeded = (await prisma.$queryRaw`
    SELECT 1 FROM "NumberSequence" WHERE "key" = ${key} LIMIT 1
  `) as unknown[];
  if (seeded.length === 0) {
    await prisma.$queryRaw`
      INSERT INTO "NumberSequence" ("key", "value", "updatedAt")
      VALUES (
        ${key},
        GREATEST(1000, COALESCE((
          SELECT MAX(substring("number" from '[0-9]+$')::bigint)
          FROM "Voucher"
          WHERE "number" LIKE ${like} AND "number" ~ ${pattern}
        ), 1000)),
        NOW()
      )
      ON CONFLICT ("key") DO NOTHING
    `;
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const rows = (await prisma.$queryRaw`
      INSERT INTO "NumberSequence" ("key", "value", "updatedAt")
      VALUES (${key}, 1001, NOW())
      ON CONFLICT ("key") DO UPDATE
        SET "value" = "NumberSequence"."value" + 1, "updatedAt" = NOW()
      RETURNING "value"
    `) as Array<{ value: number | bigint }>;

    const raw = rows[0]?.value;
    const n = typeof raw === 'bigint' ? Number(raw) : raw;
    if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error(`Could not allocate a ${prefix} number`);

    const candidate = `${prefix}-${n}`;
    // Belt and braces: a legacy number the pattern could not read (CP-1001-A,
    // say) would not have seeded the counter. Skip past it rather than failing
    // the payment on a unique-index violation.
    const taken = await prisma.voucher.findUnique({ where: { number: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  throw new Error(`Could not find a free ${prefix} number after five attempts`);
}
