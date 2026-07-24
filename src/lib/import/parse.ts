/**
 * Tolerant tabular parser. Accepts CSV, TSV, or a block pasted straight out of
 * Excel or Google Sheets — people will paste, not upload, so this has to cope
 * with quoted commas, stray blank lines and Windows line endings.
 */
export interface ParsedTable { headers: string[]; rows: string[][] }

export function parseTable(text: string): ParsedTable {
  const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!clean) return { headers: [], rows: [] };

  const lines = clean.split('\n').filter((l) => l.trim().length > 0);
  const delim = pickDelimiter(lines[0] ?? '');
  const all = lines.map((l) => splitLine(l, delim));

  const headers = (all[0] ?? []).map((h) => h.trim());
  const width = headers.length;
  const rows = all.slice(1).map((r) => {
    const out = r.slice(0, width).map((c) => c.trim());
    while (out.length < width) out.push('');
    return out;
  });
  return { headers, rows };
}

function pickDelimiter(line: string): string {
  const tabs = (line.match(/\t/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;
  const semis = (line.match(/;/g) ?? []).length;
  if (tabs >= commas && tabs >= semis && tabs > 0) return '\t';
  if (semis > commas) return ';';
  return ',';
}

function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (c === delim && !quoted) {
      out.push(cur); cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** Guess which spreadsheet column belongs to which field, so most imports need no mapping at all. */
export function autoMap(headers: string[], fields: { key: string; aliases: string[] }[]): Record<string, number> {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const map: Record<string, number> = {};
  const taken = new Set<number>();
  for (const f of fields) {
    const wanted = [f.key, ...f.aliases].map(norm);
    const idx = headers.findIndex((h, i) => !taken.has(i) && wanted.includes(norm(h)));
    if (idx >= 0) { map[f.key] = idx; taken.add(idx); }
  }
  return map;
}

export const toNumber = (v: string): number | null => {
  const raw = String(v).trim();
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.\-]/g, '');
  // Text like "TBD" or "n/a" strips down to nothing, and Number('') is 0 —
  // which would quietly import a price of zero instead of rejecting the row.
  if (!/[0-9]/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

export function toDate(v: string): Date | null {
  const t = v.trim();
  if (!t) return null;
  // dd/mm/yyyy and dd-mm-yyyy are what Indian spreadsheets produce.
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const yr = (m[3] ?? '').length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const d = new Date(yr, Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}
