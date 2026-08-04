#!/usr/bin/env node
/**
 * Rebuild `src/server/services/init-schema-sql.ts` from prisma/schema.prisma.
 *
 *   node scripts/build-init-schema.mjs
 *
 * WHY THIS EXISTS
 *
 * That file is the schema `/api/setup` uses to create a brand-new database, and
 * the one the in-app Repair button runs to bring an existing one up to date. It
 * was hand-regenerated, so it drifted: by v16.5 it was four releases behind —
 * fourteen tables and twenty-five columns short, including `User.topNavPrefs`,
 * which the signed-in layout reads on every route. The result was a deployment
 * where every screen said "Something went wrong" and the Repair button could not
 * fix it, because Repair was running the same stale SQL.
 *
 * WHY IT IS NOT JUST `prisma migrate diff`
 *
 * `migrate diff --from-empty` emits only CREATE TABLE. Against an EXISTING
 * database every one of those fails with "already exists" — which `repairSchema`
 * deliberately tolerates — and so a column added to a table that already exists
 * is never added at all. That is the exact shape of the production failure: the
 * table was there, the column was not, and the repair tool had nothing to say
 * about it. This script therefore emits, for every table:
 *
 *   CREATE TABLE IF NOT EXISTS …            ← new database
 *   ALTER TABLE … ADD COLUMN IF NOT EXISTS  ← existing database, one per column
 *
 * so the same artifact both creates and upgrades. Enums, indexes and foreign
 * keys are all guarded the same way. Every statement is safe to run repeatedly.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const raw = execFileSync(
  'npx',
  ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'],
  { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);

/** Split on `;` at end of line — the diff output has no procedural blocks. */
const statements = raw
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter((s) => s && !/^--/.test(s.replace(/\n/g, ' ').trim()) === false || s.length > 0)
  .map((s) => s.replace(/^\s*--[^\n]*\n/gm, '').trim())
  .filter(Boolean);

const out = [];
let tables = 0, columns = 0, enums = 0, indexes = 0, fks = 0;

const quoted = (s) => `'${s.replace(/'/g, "''")}'`;

for (const stmt of statements) {
  // ── Enums ────────────────────────────────────────────────────────────────
  const enumMatch = stmt.match(/^CREATE TYPE "([^"]+)" AS ENUM \(([\s\S]*)\)$/);
  if (enumMatch) {
    enums++;
    const [, typeName, values] = enumMatch;
    out.push(
      `DO $$ BEGIN\n  CREATE TYPE "${typeName}" AS ENUM (${values});\nEXCEPTION WHEN duplicate_object THEN NULL;\nEND $$;`,
    );
    // A CREATE that swallows duplicate_object repairs a MISSING enum and
    // nothing else — an enum that already exists is left exactly as it was, so
    // a value added to it later could never reach an existing database. Repair
    // then looked like it worked and the app fell over on the first insert that
    // used the new value. Same reasoning as ADD COLUMN IF NOT EXISTS below.
    //
    // ADD VALUE IF NOT EXISTS is idempotent and appends, so declaration order —
    // which is what Postgres sorts an enum by — is preserved.
    for (const v of values.split(',').map((s) => s.trim()).filter(Boolean)) {
      out.push(`ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS ${v};`);
    }
    continue;
  }

  // ── Tables: create if new, and add each column if the table already exists ─
  const tableMatch = stmt.match(/^CREATE TABLE "([^"]+)" \(([\s\S]*)\)$/);
  if (tableMatch) {
    tables++;
    const [, table, body] = tableMatch;
    out.push(`CREATE TABLE IF NOT EXISTS "${table}" (${body});`);

    // Split the body on commas that are not inside brackets, so an enum default
    // or a composite key does not get torn in half.
    const parts = [];
    let depth = 0, cur = '';
    for (const ch of body) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
      cur += ch;
    }
    parts.push(cur);

    for (const part of parts) {
      const line = part.trim().replace(/\s+/g, ' ');
      if (!line || /^CONSTRAINT\b/i.test(line) || /^PRIMARY KEY\b/i.test(line)) continue;
      const col = line.match(/^"([^"]+)"\s+([\s\S]+)$/);
      if (!col) continue;
      let [, name, rest] = col;

      // Adding a NOT NULL column with no default fails on a table that already
      // has rows. The point of this pass is to unbreak an existing install, so
      // it goes on nullable — the app always supplies the value, and a fresh
      // database still gets the constraint from CREATE TABLE above.
      if (/NOT NULL/i.test(rest) && !/DEFAULT/i.test(rest)) rest = rest.replace(/\s*NOT NULL/i, '');

      columns++;
      out.push(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${name}" ${rest};`);
    }
    continue;
  }

  // ── Indexes ──────────────────────────────────────────────────────────────
  if (/^CREATE (UNIQUE )?INDEX "/.test(stmt)) {
    indexes++;
    out.push(`${stmt.replace(/^CREATE (UNIQUE )?INDEX "/, (m, u) => `CREATE ${u ?? ''}INDEX IF NOT EXISTS "`)};`);
    continue;
  }

  // ── Foreign keys ─────────────────────────────────────────────────────────
  const fkMatch = stmt.match(/^ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)"([\s\S]*)$/);
  if (fkMatch) {
    fks++;
    const [, table, name, rest] = fkMatch;
    out.push(
      `DO $$ BEGIN\n  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = ${quoted(name)}) THEN\n` +
      `    ALTER TABLE "${table}" ADD CONSTRAINT "${name}"${rest};\n  END IF;\nEND $$;`,
    );
    continue;
  }

  out.push(`${stmt};`);
}

// ── Things Prisma cannot express, so they live here ─────────────────────────
out.push(`-- One live journal entry per source document. Prisma has no partial
-- index, so this is the only place it is declared; see MIGRATION_v16.5_all.sql.
CREATE UNIQUE INDEX IF NOT EXISTS "JournalEntry_source_once_idx"
  ON "JournalEntry"("sourceType", "sourceId")
  WHERE "sourceId" IS NOT NULL AND "status" <> 'REVERSED';`);

const sql = out.join('\n\n');
const b64 = Buffer.from(sql, 'utf8').toString('base64');

const file = `// AUTO-GENERATED — do not edit by hand.
//
// Rebuild with:  node scripts/build-init-schema.mjs
//
// This is the schema \`/api/setup\` uses to create a new database and the SQL the
// in-app Repair button runs to bring an existing one up to date. Every statement
// is idempotent, and every table is followed by ADD COLUMN IF NOT EXISTS for each
// of its columns — so this repairs an existing install, not just a virgin one.
// When it was only CREATE TABLE, a column added to an existing table could never
// be repaired, and one missing column took the whole app down with no way back.
//
// Generated from prisma/schema.prisma: ${tables} tables, ${columns} columns,
// ${enums} enums, ${indexes} indexes, ${fks} foreign keys.
export const INIT_SCHEMA_SQL_B64 =
  ${JSON.stringify(b64)};
`;

writeFileSync(path.join(root, 'src/server/services/init-schema-sql.ts'), file);
console.log(`init-schema-sql.ts rebuilt: ${tables} tables, ${columns} columns, ${enums} enums, ${indexes} indexes, ${fks} FKs (${sql.length} bytes of SQL)`);
