/**
 * Parse a GSTR-2B export (CSV text) into reconciliation rows (module #52). Column
 * names are matched case-insensitively and flexibly, because portal/GSP exports
 * vary. Pure + unit-tested so a malformed sheet yields clean skips, never a throw.
 */
export interface ParsedGstrRow {
  supplierGstin: string;
  invoiceNo: string;
  invoiceDate: string | null;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (ch === ',' && !inQ) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function num(v: string | undefined): number {
  const n = Number((v ?? '').replace(/[₹,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function findCol(headers: string[], ...needles: string[]): number {
  return headers.findIndex((h) => needles.some((n) => h.includes(n)));
}

export function parseGstrCsv(csv: string): ParsedGstrRow[] {
  const lines = (csv ?? '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0] ?? '').map((h) => h.toLowerCase());
  const iGstin = findCol(headers, 'gstin', 'supplier');
  const iInv = findCol(headers, 'invoice no', 'invoice number', 'invoiceno', 'invoice');
  const iDate = findCol(headers, 'date');
  const iTax = findCol(headers, 'taxable');
  const iIgst = findCol(headers, 'igst', 'integrated');
  const iCgst = findCol(headers, 'cgst', 'central');
  const iSgst = findCol(headers, 'sgst', 'state');
  const rows: ParsedGstrRow[] = [];
  for (let r = 1; r < lines.length; r++) {
    const c = splitCsvLine(lines[r] ?? '');
    const invoiceNo = (iInv >= 0 ? c[iInv] : '')?.trim() ?? '';
    if (!invoiceNo) continue; // an invoice number is the minimum for a usable row
    rows.push({
      supplierGstin: (iGstin >= 0 ? c[iGstin] : '')?.trim() ?? '',
      invoiceNo,
      invoiceDate: iDate >= 0 && c[iDate] ? (c[iDate] ?? '').trim() : null,
      taxableValue: num(iTax >= 0 ? c[iTax] : undefined),
      igst: num(iIgst >= 0 ? c[iIgst] : undefined),
      cgst: num(iCgst >= 0 ? c[iCgst] : undefined),
      sgst: num(iSgst >= 0 ? c[iSgst] : undefined),
    });
  }
  return rows;
}
