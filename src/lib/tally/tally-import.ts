import 'server-only';
import { XMLParser } from 'fast-xml-parser';

/**
 * Parser for data exported from real Tally (Prime / ERP 9).
 *
 * Supports the two formats a Tally user can actually produce without any add-on:
 *   • XML  — Gateway of Tally → Export → Masters / Day Book, Format: XML.
 *            This is Tally's native format and carries the full double-entry
 *            structure, so it is the preferred path.
 *   • CSV  — a Day Book / ledger export. Flat and lossy, offered as a fallback.
 *
 * Design notes
 * ────────────
 * Sign convention: in Tally's XML a ledger entry's <AMOUNT> is NEGATIVE for a
 * debit and POSITIVE for a credit, and <ISDEEMEDPOSITIVE>Yes</> marks the debit
 * side. Rather than trusting that blindly we apply it AND re-check that every
 * voucher balances; anything that does not balance is surfaced as a warning in
 * the preview instead of being written. That way a convention mismatch is caught
 * loudly by the operator rather than silently corrupting the books.
 *
 * Nothing here touches the database — parsing is pure so it can be unit-tested
 * and so a malformed file can never leave a half-written ledger behind.
 */

export interface ParsedLedger {
  name: string;
  group: string;
  openingBalance: number; // absolute value
  openingSide: 'Dr' | 'Cr';
  guid?: string | null;
}

export interface ParsedLine {
  ledgerName: string;
  debit: number;
  credit: number;
}

export interface ParsedVoucher {
  number: number | null;
  type: string;
  date: Date;
  narration: string | null;
  reference: string | null;
  costCentre: string | null;
  guid: string | null;
  lines: ParsedLine[];
  inventory: ParsedInventoryLine[];
  balanced: boolean;
}

export interface ParsedStockItem {
  name: string;
  unit: string;
  hsn: string | null;
  gstRate: number;
  openingQty: number;
  openingRate: number;
}

export interface ParsedInventoryLine {
  itemName: string;
  qty: number;
  rate: number;
  amount: number;
  direction: 'IN' | 'OUT';
}

export interface ParsedCompany {
  name: string;
  guid: string | null;
  ledgers: ParsedLedger[];
  vouchers: ParsedVoucher[];
  stockItems: ParsedStockItem[];
  costCentres: string[];
}

export interface ParseResult {
  companies: ParsedCompany[];
  warnings: string[];
  totals: { ledgers: number; vouchers: number; lines: number; unbalanced: number; stockItems: number; costCentres: number; inventoryLines: number };
  dateRange: { from: Date | null; to: Date | null };
}

const EMPTY_TOTALS = { ledgers: 0, vouchers: 0, lines: 0, unbalanced: 0, stockItems: 0, costCentres: 0, inventoryLines: 0 };

/** Tally writes dates as YYYYMMDD; also tolerate ISO and DD-MM-YYYY. */
export function parseTallyDate(raw: unknown): Date | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return safeDate(+m[1]!, +m[2]!, +m[3]!);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return safeDate(+m[1]!, +m[2]!, +m[3]!);
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return safeDate(+m[3]!, +m[2]!, +m[1]!);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function safeDate(y: number, mo: number, d: number): Date | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function num(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  // Tally may emit "1,000.00", "(-)1000", or a plain number.
  const s = String(raw).replace(/[,\s₹]/g, '').replace(/\(-\)/, '-');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Tally writes quantities as "100 Bag" / "-5 Nos" and rates as "350.00/Bag". */
export function parseQty(raw: unknown): { qty: number; unit: string } {
  const s = String(raw ?? '').trim();
  if (!s) return { qty: 0, unit: '' };
  const m = s.match(/^\s*(-?[\d.,]+)\s*(.*)$/);
  if (!m) return { qty: 0, unit: '' };
  return { qty: num(m[1]), unit: (m[2] ?? '').trim() };
}
export function parseRate(raw: unknown): number {
  const s = String(raw ?? '').trim();
  if (!s) return 0;
  return num(s.split('/')[0]);
}

function text(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    // fast-xml-parser puts element text under #text when attributes are present
    if ('#text' in o) return String(o['#text'] ?? '').trim();
    return '';
  }
  return String(raw).trim();
}

/** Always work with an array, whatever the parser handed back. */
function arr<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  parseTagValue: false,      // keep raw strings; we coerce ourselves
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  // Tally tag names vary in case between versions — normalise to UPPER.
  transformTagName: (t) => t.toUpperCase(),
  transformAttributeName: (a) => a.toUpperCase(),
});

/** Recursively collect every node with the given tag name, at any depth. */
function collect(node: unknown, tag: string, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (!node || typeof node !== 'object') return out;
  if (Array.isArray(node)) {
    for (const n of node) collect(n, tag, out);
    return out;
  }
  const obj = node as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    if (k === tag) for (const item of arr(v as never)) if (item && typeof item === 'object') out.push(item as Record<string, unknown>);
    if (v && typeof v === 'object') collect(v, tag, out);
  }
  return out;
}

/** Pull the company name Tally stamped into the export, if any. */
function findCompanyName(root: unknown): string | null {
  for (const key of ['SVCURRENTCOMPANY', 'REPORTNAME', 'COMPANYNAME']) {
    const hits = collect(root, key);
    if (hits.length) {
      const v = text(hits[0]);
      if (v && key === 'SVCURRENTCOMPANY') return v;
    }
  }
  // <STATICVARIABLES><SVCURRENTCOMPANY>ABC Ltd</SVCURRENTCOMPANY></STATICVARIABLES>
  const sv = collect(root, 'STATICVARIABLES');
  for (const s of sv) {
    const v = text(s['SVCURRENTCOMPANY']);
    if (v) return v;
  }
  const comp = collect(root, 'COMPANY');
  for (const c of comp) {
    const v = text(c['NAME']) || text(c['@NAME']);
    if (v) return v;
  }
  return null;
}

/**
 * Parse a Tally XML export. `fallbackCompany` is used when the file carries no
 * company name (some exports omit it).
 */
export function parseTallyXml(xml: string, fallbackCompany = 'Imported Company'): ParseResult {
  const warnings: string[] = [];
  let root: unknown;
  try {
    root = parser.parse(xml);
  } catch {
    return {
      companies: [], warnings: ['This file could not be read as XML. Re-export from Tally choosing Format: XML.'],
      totals: EMPTY_TOTALS, dateRange: { from: null, to: null },
    };
  }

  const companyName = findCompanyName(root) || fallbackCompany;

  // ── Masters ──────────────────────────────────────────────────────────────
  const ledgers: ParsedLedger[] = [];
  const seenLedger = new Set<string>();
  for (const l of collect(root, 'LEDGER')) {
    const name = text(l['@NAME']) || text(l['NAME']);
    if (!name || seenLedger.has(name.toLowerCase())) continue;
    seenLedger.add(name.toLowerCase());
    const ob = num(l['OPENINGBALANCE']);
    ledgers.push({
      name,
      group: text(l['PARENT']) || 'Suspense A/c',
      openingBalance: Math.abs(ob),
      // Tally: a negative opening balance is a debit balance.
      openingSide: ob < 0 ? 'Dr' : 'Cr',
      guid: text(l['GUID']) || null,
    });
  }

  // ── Stock items ──────────────────────────────────────────────────────────
  const stockItems: ParsedStockItem[] = [];
  const seenItem = new Set<string>();
  for (const it of collect(root, 'STOCKITEM')) {
    const name = text(it['@NAME']) || text(it['NAME']);
    if (!name || seenItem.has(name.toLowerCase())) continue;
    seenItem.add(name.toLowerCase());
    const ob = parseQty(it['OPENINGBALANCE']);
    // HSN and GST rate can sit inline or inside GSTDETAILS.LIST.
    let hsn = text(it['HSNCODE']) || null;
    let gstRate = num(it['GSTRATE']);
    for (const g of collect(it, 'GSTDETAILS.LIST')) {
      if (!hsn) hsn = text(g['HSNCODE']) || null;
      for (const r of collect(g, 'STATEWISEDETAILS.LIST')) {
        for (const d of collect(r, 'RATEDETAILS.LIST')) {
          const dutyHead = text(d['GSTRATEDUTYHEAD']).toLowerCase();
          const rate = num(d['GSTRATE']);
          // Central + State each carry half the total rate.
          if (rate > 0 && (dutyHead.includes('central') || dutyHead.includes('state'))) gstRate = Math.max(gstRate, rate * 2);
          else if (rate > 0 && dutyHead.includes('integrated')) gstRate = Math.max(gstRate, rate);
        }
      }
    }
    stockItems.push({
      name,
      unit: text(it['BASEUNITS']) || ob.unit || 'Nos',
      hsn,
      gstRate,
      openingQty: Math.abs(ob.qty),
      openingRate: parseRate(it['OPENINGRATE']),
    });
  }

  // ── Cost centres ─────────────────────────────────────────────────────────
  const costCentreSet = new Map<string, string>();
  for (const cc of collect(root, 'COSTCENTRE')) {
    const name = text(cc['@NAME']) || text(cc['NAME']);
    if (name) costCentreSet.set(name.toLowerCase(), name);
  }

  // ── Vouchers ─────────────────────────────────────────────────────────────
  const vouchers: ParsedVoucher[] = [];
  let lineCount = 0;
  let unbalanced = 0;
  let from: Date | null = null;
  let to: Date | null = null;

  for (const v of collect(root, 'VOUCHER')) {
    const date = parseTallyDate(v['DATE']) ?? parseTallyDate(v['EFFECTIVEDATE']);
    if (!date) { warnings.push('Skipped a voucher with no readable date.'); continue; }

    const type = text(v['VOUCHERTYPENAME']) || text(v['@VCHTYPE']) || 'Journal';
    const numRaw = text(v['VOUCHERNUMBER']);
    const parsedNum = numRaw ? Number(String(numRaw).replace(/\D/g, '')) : NaN;

    // Entries live under ALLLEDGERENTRIES.LIST or LEDGERENTRIES.LIST depending on
    // the voucher type; some exports use both.
    const entries = [
      ...arr(v['ALLLEDGERENTRIES.LIST'] as never),
      ...arr(v['LEDGERENTRIES.LIST'] as never),
    ] as Record<string, unknown>[];

    const lines: ParsedLine[] = [];
    for (const e of entries) {
      if (!e || typeof e !== 'object') continue;
      const ledgerName = text(e['LEDGERNAME']);
      if (!ledgerName) continue;
      const amt = num(e['AMOUNT']);
      if (amt === 0) continue;
      const deemedPositive = text(e['ISDEEMEDPOSITIVE']).toLowerCase() === 'yes';
      const isDebit = deemedPositive || amt < 0;
      const abs = Math.abs(amt);
      lines.push({ ledgerName, debit: isDebit ? abs : 0, credit: isDebit ? 0 : abs });
    }
    // Inventory entries (stock movement on Sales / Purchase / Stock Journal).
    const inventory: ParsedInventoryLine[] = [];
    for (const e of collect(v, 'ALLINVENTORYENTRIES.LIST')) {
      const itemName = text(e['STOCKITEMNAME']);
      if (!itemName) continue;
      const q = parseQty(e['ACTUALQTY'] ?? e['BILLEDQTY']);
      const amt = num(e['AMOUNT']);
      if (q.qty === 0 && amt === 0) continue;
      // Tally: a negative inventory amount is stock coming IN (a purchase).
      const deemedPositive = text(e['ISDEEMEDPOSITIVE']).toLowerCase() === 'yes';
      const dir: 'IN' | 'OUT' = deemedPositive || amt < 0 ? 'IN' : 'OUT';
      inventory.push({
        itemName,
        qty: Math.abs(q.qty),
        rate: parseRate(e['RATE']),
        amount: Math.abs(amt),
        direction: dir,
      });
      if (!seenItem.has(itemName.toLowerCase())) {
        seenItem.add(itemName.toLowerCase());
        stockItems.push({ name: itemName, unit: q.unit || 'Nos', hsn: null, gstRate: 0, openingQty: 0, openingRate: 0 });
      }
    }

    // Cost-centre allocation — take the first named centre as the voucher tag.
    let costCentre: string | null = null;
    for (const a of collect(v, 'COSTCENTREALLOCATIONS.LIST')) {
      const nm = text(a['NAME']);
      if (nm) { costCentre = nm; costCentreSet.set(nm.toLowerCase(), nm); break; }
    }

    if (!lines.length) continue;

    const dr = lines.reduce((s, l) => s + l.debit, 0);
    const cr = lines.reduce((s, l) => s + l.credit, 0);
    const balanced = Math.abs(dr - cr) < 0.01;
    if (!balanced) unbalanced++;

    lineCount += lines.length;
    if (!from || date < from) from = date;
    if (!to || date > to) to = date;

    vouchers.push({
      number: Number.isFinite(parsedNum) && parsedNum > 0 ? parsedNum : null,
      type,
      date,
      narration: text(v['NARRATION']) || null,
      reference: text(v['REFERENCE']) || null,
      costCentre,
      guid: text(v['GUID']) || null,
      lines,
      inventory,
      balanced,
    });
  }

  // Any ledger referenced by a voucher but never declared as a master still
  // needs to exist, or the voucher cannot be written. Create it as a stub.
  const declared = new Set(ledgers.map((l) => l.name.toLowerCase()));
  const implied = new Map<string, string>();
  for (const v of vouchers) {
    for (const l of v.lines) {
      const k = l.ledgerName.toLowerCase();
      if (!declared.has(k) && !implied.has(k)) implied.set(k, l.ledgerName);
    }
  }
  for (const name of implied.values()) {
    ledgers.push({ name, group: 'Suspense A/c', openingBalance: 0, openingSide: 'Dr', guid: null });
  }
  if (implied.size) {
    warnings.push(`${implied.size} ledger(s) appear in vouchers but were not in the masters export — they will be created under "Suspense A/c". Export Masters as well for correct grouping.`);
  }
  if (unbalanced) {
    warnings.push(`${unbalanced} voucher(s) do not balance (debits ≠ credits). These are NOT imported. Re-export the Day Book with complete ledger entries.`);
  }
  if (!ledgers.length && !vouchers.length) {
    warnings.push('No ledgers or vouchers were found in this file. In Tally choose Export → Masters (All Masters) or Day Book, with Format: XML.');
  }

  const costCentres = [...costCentreSet.values()];
  const inventoryLines = vouchers.reduce((n, v) => n + v.inventory.length, 0);

  return {
    companies: [{ name: companyName, guid: null, ledgers, vouchers, stockItems, costCentres }],
    warnings,
    totals: {
      ledgers: ledgers.length, vouchers: vouchers.length, lines: lineCount, unbalanced,
      stockItems: stockItems.length, costCentres: costCentres.length, inventoryLines,
    },
    dateRange: { from, to },
  };
}

/* ── CSV ──────────────────────────────────────────────────────────────────── */

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/**
 * Parse a flat CSV/Day-Book style export. Expected (case-insensitive) headers:
 *   Date, Voucher Type, Voucher No, Ledger, Debit, Credit, Narration
 * Consecutive rows sharing Date + Voucher Type + Voucher No form one voucher.
 */
export function parseTallyCsv(csv: string, companyName = 'Imported Company'): ParseResult {
  const warnings: string[] = [];
  const rows = csv.split(/\r?\n/).filter((r) => r.trim().length);
  if (rows.length < 2) {
    return { companies: [], warnings: ['The CSV appears to be empty.'], totals: EMPTY_TOTALS, dateRange: { from: null, to: null } };
  }
  const header = splitCsvLine(rows[0]!).map((h) => h.toLowerCase().replace(/[^a-z]/g, ''));
  const idx = (...names: string[]) => {
    for (const n of names) { const i = header.indexOf(n); if (i >= 0) return i; }
    return -1;
  };
  const iDate = idx('date', 'vchdate');
  const iType = idx('vouchertype', 'vchtype', 'type');
  const iNo = idx('voucherno', 'vchno', 'number', 'vouchernumber');
  const iLed = idx('ledger', 'ledgername', 'particulars', 'account');
  const iDr = idx('debit', 'dr', 'debitamount');
  const iCr = idx('credit', 'cr', 'creditamount');
  const iNar = idx('narration', 'remarks', 'description');

  if (iDate < 0 || iLed < 0 || (iDr < 0 && iCr < 0)) {
    return {
      companies: [], warnings: ['Could not find the required columns. The CSV needs at least: Date, Ledger, Debit and Credit.'],
      totals: EMPTY_TOTALS, dateRange: { from: null, to: null },
    };
  }

  const groups = new Map<string, ParsedVoucher>();
  const ledgerNames = new Map<string, string>();
  let from: Date | null = null;
  let to: Date | null = null;
  let lineCount = 0;

  for (let r = 1; r < rows.length; r++) {
    const c = splitCsvLine(rows[r]!);
    const date = parseTallyDate(c[iDate]);
    const ledgerName = (c[iLed] ?? '').trim();
    if (!date || !ledgerName) continue;
    const debit = iDr >= 0 ? Math.abs(num(c[iDr])) : 0;
    const credit = iCr >= 0 ? Math.abs(num(c[iCr])) : 0;
    if (debit === 0 && credit === 0) continue;

    const type = (iType >= 0 ? c[iType] : '') || 'Journal';
    const noRaw = iNo >= 0 ? (c[iNo] ?? '') : '';
    const parsedNum = Number(String(noRaw).replace(/\D/g, ''));
    const key = `${date.toISOString().slice(0, 10)}|${type}|${noRaw}`;

    let v = groups.get(key);
    if (!v) {
      v = {
        number: Number.isFinite(parsedNum) && parsedNum > 0 ? parsedNum : null,
        type: String(type), date,
        narration: iNar >= 0 ? (c[iNar] || null) : null,
        reference: null, costCentre: null, guid: null, lines: [], inventory: [], balanced: false,
      };
      groups.set(key, v);
      if (!from || date < from) from = date;
      if (!to || date > to) to = date;
    }
    v.lines.push({ ledgerName, debit, credit });
    lineCount++;
    const k = ledgerName.toLowerCase();
    if (!ledgerNames.has(k)) ledgerNames.set(k, ledgerName);
  }

  let unbalanced = 0;
  const vouchers = [...groups.values()];
  for (const v of vouchers) {
    const dr = v.lines.reduce((s, l) => s + l.debit, 0);
    const cr = v.lines.reduce((s, l) => s + l.credit, 0);
    v.balanced = Math.abs(dr - cr) < 0.01;
    if (!v.balanced) unbalanced++;
  }
  if (unbalanced) warnings.push(`${unbalanced} voucher(s) do not balance and will not be imported.`);
  warnings.push('CSV carries no account groups — every new ledger lands under "Suspense A/c". Import the XML export instead for a correct chart of accounts.');

  const ledgers: ParsedLedger[] = [...ledgerNames.values()].map((name) => ({
    name, group: 'Suspense A/c', openingBalance: 0, openingSide: 'Dr' as const, guid: null,
  }));

  return {
    companies: [{ name: companyName, guid: null, ledgers, vouchers, stockItems: [], costCentres: [] }],
    warnings,
    totals: {
      ledgers: ledgers.length, vouchers: vouchers.length, lines: lineCount, unbalanced,
      stockItems: 0, costCentres: 0, inventoryLines: 0,
    },
    dateRange: { from, to },
  };
}

/** Route to the right parser by file extension / content sniff. */
export function parseTallyFile(content: string, fileName: string, fallbackCompany?: string): ParseResult {
  const looksXml = /^\s*<\?xml|<ENVELOPE|<TALLYMESSAGE/i.test(content.slice(0, 500));
  if (looksXml || /\.xml$/i.test(fileName)) return parseTallyXml(content, fallbackCompany);
  return parseTallyCsv(content, fallbackCompany);
}
