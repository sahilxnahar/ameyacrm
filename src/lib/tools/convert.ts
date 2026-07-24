/**
 * File conversions that run entirely in the browser — no server, no AI tokens,
 * no upload. The files never leave the user's machine. pdf-lib and SheetJS are
 * both already bundled (used elsewhere) and are imported on demand so this only
 * loads when someone actually converts something.
 *
 * The pure text helpers (parseCsv / rowsToMarkdown / rowsToJson) have no browser
 * dependency and are unit-tested; the pdf/xlsx glue returns Blobs for download.
 */

// ─────────────────────────── pure text helpers ───────────────────────────

/** Parse CSV text into a grid, honouring quoted fields, commas and newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  // Strip a UTF-8 BOM if present.
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      // Swallow \r\n as one break; ignore a stray \r.
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += c;
  }
  // Flush the trailing field/row (unless the file ended on a clean newline).
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** Render a grid as a GitHub-flavoured Markdown table (first row = header). */
export function rowsToMarkdown(rows: string[][]): string {
  if (!rows.length) return '';
  const cols = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => Array.from({ length: cols }, (_, i) => (r[i] ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim());
  const head = rows[0] ?? [];
  const body = rows.slice(1);
  const lines = [
    `| ${pad(head).join(' | ')} |`,
    `| ${Array.from({ length: cols }, () => '---').join(' | ')} |`,
    ...body.map((r) => `| ${pad(r).join(' | ')} |`),
  ];
  return lines.join('\n') + '\n';
}

/** Turn a grid into an array of objects, using the first row as keys. */
export function rowsToJson(rows: string[][]): Record<string, string>[] {
  if (rows.length < 1) return [];
  const head = rows[0] ?? [];
  const body = rows.slice(1);
  const keys = head.map((k, i) => (k.trim() || `column_${i + 1}`));
  return body
    .filter((r) => r.some((c) => c !== ''))
    .map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])));
}

// ─────────────────────────── browser glue (Blobs) ───────────────────────────

/** Combine several PDFs into one, in the order given. */
export async function mergePdfs(files: File[]): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const out = await PDFDocument.create();
  for (const f of files) {
    const src = await PDFDocument.load(await f.arrayBuffer());
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  const bytes = await out.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

/**
 * Extract a 1-based, inclusive page range into a new PDF. Pass no range (or an
 * out-of-bounds one) and it clamps to the document. Returns the new PDF and how
 * many pages it holds.
 */
export async function extractPdfPages(file: File, from: number, to: number): Promise<{ blob: Blob; pages: number }> {
  const { PDFDocument } = await import('pdf-lib');
  const src = await PDFDocument.load(await file.arrayBuffer());
  const total = src.getPageCount();
  const start = Math.max(1, Math.min(from || 1, total));
  const end = Math.max(start, Math.min(to || total, total));
  const out = await PDFDocument.create();
  const indices = Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
  const pages = await out.copyPages(src, indices);
  pages.forEach((p) => out.addPage(p));
  const bytes = await out.save();
  return { blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }), pages: indices.length };
}

/** Build a PDF from images (JPG / PNG), one image per page, sized to the image. */
export async function imagesToPdf(files: File[]): Promise<Blob> {
  const { PDFDocument } = await import('pdf-lib');
  const out = await PDFDocument.create();
  for (const f of files) {
    const buf = await f.arrayBuffer();
    const isPng = f.type.includes('png') || /\.png$/i.test(f.name);
    const img = isPng ? await out.embedPng(buf) : await out.embedJpg(buf);
    const page = out.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  const bytes = await out.save();
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}

/** Read the first sheet of any spreadsheet (or CSV) into a grid of strings. */
async function readSheetGrid(file: File): Promise<string[][]> {
  const name = (file.name || '').toLowerCase();
  if (/\.(csv|tsv|txt)$/.test(name) || file.type.startsWith('text/')) {
    return parseCsv(await file.text());
  }
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const first = wb.SheetNames[0];
  const ws = first ? wb.Sheets[first] : undefined;
  if (!ws) return [];
  const csv = XLSX.utils.sheet_to_csv(ws);
  return parseCsv(csv);
}

/** CSV (or Excel) → a real .xlsx workbook. */
export async function toXlsx(file: File): Promise<Blob> {
  const XLSX = await import('xlsx');
  const grid = await readSheetGrid(file);
  const ws = XLSX.utils.aoa_to_sheet(grid);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** Spreadsheet (or CSV) → CSV text. */
export async function toCsv(file: File): Promise<Blob> {
  const grid = await readSheetGrid(file);
  const esc = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const csv = grid.map((r) => r.map(esc).join(',')).join('\n') + '\n';
  return new Blob([csv], { type: 'text/csv' });
}

/** Spreadsheet (or CSV) → JSON array (first row = keys). */
export async function toJson(file: File): Promise<Blob> {
  const grid = await readSheetGrid(file);
  return new Blob([JSON.stringify(rowsToJson(grid), null, 2)], { type: 'application/json' });
}

/** Spreadsheet (or CSV) → Markdown table. */
export async function toMarkdown(file: File): Promise<Blob> {
  const grid = await readSheetGrid(file);
  return new Blob([rowsToMarkdown(grid)], { type: 'text/markdown' });
}

/** Trigger a browser download of a Blob under the given name. */
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Swap a file's extension (keeps the base name). */
export function reExt(name: string, ext: string): string {
  return name.replace(/\.[^./\\]+$/, '') + '.' + ext.replace(/^\./, '');
}
