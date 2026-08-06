import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INIT_SCHEMA_SQL_B64 } from '../src/server/services/init-schema-sql';

/*
 * The Repair button must know about every column in the schema.
 *
 * `init-schema-sql.ts` is generated from prisma/schema.prisma by
 * scripts/build-init-schema.mjs, and it is what /api/setup runs to create a
 * database and what the in-app Repair button runs to bring an existing one up
 * to date. Nothing forces it to be regenerated when a column is added.
 *
 * It fell behind exactly once and the failure was invisible in the worst way:
 * three columns had been added to VendorBill and one to Voucher, the app queried
 * them, and Repair — the thing a person presses when a screen breaks — silently
 * did nothing at all, because it had never been told those columns existed. The
 * screen stayed broken and the only remedy left was hand-run SQL.
 *
 * This compares the two directly. If it fails, run:
 *     node scripts/build-init-schema.mjs
 */
const SQL = Buffer.from(INIT_SCHEMA_SQL_B64, 'base64').toString('utf8');

/** Every `Model.field` scalar column declared in the Prisma schema. */
function prismaColumns(): Set<string> {
  const src = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
  const out = new Set<string>();
  const modelRe = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let m: RegExpExecArray | null;
  while ((m = modelRe.exec(src))) {
    const [, model, body] = m;
    for (const raw of body!.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('//') || line.startsWith('@@')) continue;
      const f = /^(\w+)\s+(\w+)(\[\])?(\?)?/.exec(line);
      if (!f) continue;
      const [, field, type, list] = f;
      // Relations are not columns: a list of another model, or a field carrying
      // an @relation attribute. The scalar foreign key beside it is a column and
      // is matched on its own line.
      if (list) continue;
      if (/@relation\(/.test(line) && /^[A-Z]/.test(type!)) continue;
      if (/^[A-Z]/.test(type!) && !isEnumOrScalar(src, type!)) continue;
      out.add(`${model}.${field}`);
    }
  }
  return out;
}

function isEnumOrScalar(src: string, type: string): boolean {
  if (['String', 'Int', 'BigInt', 'Float', 'Decimal', 'Boolean', 'DateTime', 'Json', 'Bytes'].includes(type)) return true;
  return new RegExp(`^enum\\s+${type}\\s*\\{`, 'm').test(src);
}

/** Every column the generated repair SQL knows how to add. */
function sqlColumns(): Set<string> {
  const out = new Set<string>();
  const re = /ALTER TABLE "(\w+)" ADD COLUMN IF NOT EXISTS "(\w+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(SQL))) out.add(`${m[1]}.${m[2]}`);
  return out;
}

describe('the Repair button is not out of date', () => {
  it('knows about every column in prisma/schema.prisma', { timeout: 15_000 }, () => {
    // The Prisma schema is large; the regex pass takes ~2.5s alone and can
    // take 7-8s under parallel test load. The default 5s timeout is too tight.
    const missing = [...prismaColumns()].filter((c) => !sqlColumns().has(c)).sort();
    expect(
      missing,
      `init-schema-sql.ts is stale — run: node scripts/build-init-schema.mjs\nMissing: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('specifically covers the columns that were missed', () => {
    // Named so a regression on these exact four is unmistakable in the output.
    for (const c of [
      'VendorBill.attachmentUrl',
      'VendorBill.attachmentName',
      'VendorBill.notes',
      'Voucher.deductionAmount',
    ]) {
      expect(sqlColumns().has(c), `${c} would not be repaired`).toBe(true);
    }
  });

  it('adds columns idempotently, so Repair is safe to press twice', () => {
    expect(SQL).not.toMatch(/ALTER TABLE "\w+" ADD COLUMN "(?!IF)/);
  });
});
