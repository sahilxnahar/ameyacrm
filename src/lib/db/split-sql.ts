/**
 * Split a SQL script into executable statements.
 *
 * Splitting on ";\n" is wrong, and wrong in a way that hides itself: a
 * `DO $$ BEGIN ... END $$;` block contains its own semicolons, so a naive split
 * tears it into fragments and Postgres rejects each one with "unterminated
 * dollar-quoted string". Thirty-two statements failed that way — every
 * conditional constraint and enum guard in the migration — while the other 591
 * succeeded, so the repair looked like it had mostly worked.
 *
 * This walks the text once and only treats a semicolon as a boundary when it
 * is not inside a string, a comment, or a dollar-quoted body.
 */
export function splitSql(sql: string): string[] {
  const out: string[] = [];
  let buf = '';
  let i = 0;

  while (i < sql.length) {
    const rest = sql.slice(i);

    // Line comment — keep it, it costs nothing and aids debugging.
    if (rest.startsWith('--')) {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? sql.length : end + 1;
      buf += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // Block comment.
    if (rest.startsWith('/*')) {
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      buf += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // Single-quoted literal; '' is an escaped quote, not a terminator.
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") { j += 2; continue; }
        if (sql[j] === "'") { j += 1; break; }
        j += 1;
      }
      buf += sql.slice(i, j);
      i = j;
      continue;
    }

    // Double-quoted identifier.
    if (sql[i] === '"') {
      const end = sql.indexOf('"', i + 1);
      const stop = end === -1 ? sql.length : end + 1;
      buf += sql.slice(i, stop);
      i = stop;
      continue;
    }

    // Dollar-quoted body: $$ … $$ or $tag$ … $tag$.
    const dollar = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(rest);
    if (dollar) {
      const tag = dollar[0];
      const end = sql.indexOf(tag, i + tag.length);
      const stop = end === -1 ? sql.length : end + tag.length;
      buf += sql.slice(i, stop);
      i = stop;
      continue;
    }

    if (sql[i] === ';') {
      out.push(buf);
      buf = '';
      i += 1;
      continue;
    }

    buf += sql[i];
    i += 1;
  }
  if (buf.trim()) out.push(buf);

  // Drop anything that is only comments and whitespace.
  return out
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.split('\n').some((l) => l.trim() && !l.trim().startsWith('--')));
}
