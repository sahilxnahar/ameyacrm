import 'server-only';
import { prisma } from '@/lib/db/prisma';

/**
 * Only the raw-query capability is needed, so the parameter is typed to exactly
 * that. Prisma's client and its transaction client have structurally different
 * model types and do not unify, but both satisfy this.
 */
type Raw = { $queryRaw: (q: TemplateStringsArray, ...v: unknown[]) => Promise<unknown> };

/**
 * Allocate the next value of a named counter, atomically.
 *
 * The whole allocation is ONE statement: Postgres serialises concurrent writers
 * on the row, so each caller gets a distinct value even under load. Pass the
 * surrounding transaction when the number is used in an insert in that same
 * transaction, so a rollback doesn't leave a consumed number behind.
 */
export async function nextSequence(key: string, tx: Raw = prisma as unknown as Raw, start = 1000): Promise<number> {
  const rows = (await tx.$queryRaw`
    INSERT INTO "NumberSequence" ("key", "value", "updatedAt")
    VALUES (${key}, ${start + 1}, NOW())
    ON CONFLICT ("key") DO UPDATE
      SET "value" = "NumberSequence"."value" + 1, "updatedAt" = NOW()
    RETURNING "value"
  `) as Array<{ value: number | bigint }>;
  // Postgres integers can arrive as bigint through the raw driver.
  const raw = rows[0]?.value;
  const v = typeof raw === 'bigint' ? Number(raw) : raw;
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`Could not allocate a number for ${key}`);
  }
  return v;
}

/** Zero-padded document number, e.g. docNumber('JV', 317, 6) → "JV-000317". */
export function docNumber(prefix: string, n: number, pad = 0): string {
  return `${prefix}-${pad ? String(n).padStart(pad, '0') : String(n)}`;
}
