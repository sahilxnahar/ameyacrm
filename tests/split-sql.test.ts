import { describe, it, expect } from 'vitest';
import { splitSql } from '@/lib/db/split-sql';

describe('splitSql', () => {
  it('keeps a DO $$ … $$ block whole', () => {
    const sql = `
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "repeatEvery" INTEGER;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_a') THEN
    ALTER TABLE "A" ADD CONSTRAINT "fk_a" FOREIGN KEY ("bId") REFERENCES "B"("id");
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "i" ON "A"("bId");
`;
    const parts = splitSql(sql);
    expect(parts).toHaveLength(3);
    expect(parts[1]).toContain('END IF');
    expect(parts[1]).toContain('END $$');
  });

  it('does not split on a semicolon inside a string literal', () => {
    const parts = splitSql(`INSERT INTO "S" ("v") VALUES ('a;b'); SELECT 1;`);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain("'a;b'");
  });

  it('handles a doubled quote inside a literal', () => {
    const parts = splitSql(`INSERT INTO "S" ("v") VALUES ('it''s; fine'); SELECT 1;`);
    expect(parts).toHaveLength(2);
  });

  it('handles a tagged dollar quote', () => {
    const parts = splitSql(`DO $mig$ BEGIN PERFORM 1; END $mig$; SELECT 1;`);
    expect(parts).toHaveLength(2);
  });

  it('drops comment-only fragments', () => {
    expect(splitSql(`-- just a note\n;\nSELECT 1;`)).toHaveLength(1);
  });
});
