import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { splitSql } from '@/lib/db/split-sql';

/**
 * Guards the actual migration, not a toy example.
 *
 * The old splitter tore fourteen `DO $$ … $$` blocks into fragments, and
 * Postgres rejected every fragment. That is what "591 applied, 32 failed"
 * was, and why the repair looked like it had almost worked.
 */
function migrationSql(): string {
  const src = readFileSync('src/server/services/init-schema-sql.ts', 'utf8');
  const m = /INIT_SCHEMA_SQL_B64\s*=\s*['"`]([A-Za-z0-9+/=\s]+)['"`]/s.exec(src);
  if (!m || !m[1]) throw new Error('INIT_SCHEMA_SQL_B64 not found');
  return Buffer.from(m[1].replace(/\s/g, ''), 'base64').toString('utf8');
}

describe('the real migration', () => {
  it('splits with every dollar-quote balanced', () => {
    const parts = splitSql(migrationSql());
    const broken = parts.filter((p) => (p.match(/\$\$/g)?.length ?? 0) % 2 === 1);
    expect(broken).toHaveLength(0);
    expect(parts.length).toBeGreaterThan(400);
  });

  it('the old naive splitter really did break it', () => {
    // Kept as evidence: this is the bug, reproduced.
    const naive = migrationSql().split(/;\s*\n/).filter((x) => x.trim());
    const broken = naive.filter((p) => (p.match(/\$\$/g)?.length ?? 0) % 2 === 1);
    expect(broken.length).toBeGreaterThan(0);
  });
});
