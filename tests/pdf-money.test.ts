import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { formatCurrency, formatCurrencyForPdf, formatQuantity, formatAmountPlain } from '@/lib/utils/format';

/**
 * AMH-066 — what a customer actually reads on an invoice.
 *
 * The ₹ glyph is not in the PDF standard base fonts, so every generator here
 * runs its strings through an `ascii()` filter. Six of them then built the
 * amount as `Rs. ${formatCurrency(n)}` — and `formatCurrency` already emits ₹.
 *
 * Two different wrong outputs, depending on which ascii() the file has:
 *
 *   plain filter  →  "Rs.  1,50,000"     (symbol dropped, stray double space)
 *   ₹→Rs. filter  →  "Rs. Rs.1,50,000"   (doubled prefix)
 *
 * On the tax invoice, the cost sheet, the demand letter, the payment receipt
 * and RERA Form 5. These are the documents that leave the building.
 */

const PDF_DIR = 'src/lib/pdf';
const pdfFiles = readdirSync(PDF_DIR).filter((f) => f.endsWith('.ts'));

/** The two ascii() shapes actually used in this directory. */
const asciiPlain = (s: string) => s.replace(/[^\x20-\x7E]/g, ' ');
const asciiRupeeMapped = (s: string) => s.replace(/₹/g, 'Rs.').replace(/[^\x20-\x7E]/g, ' ');

describe('money in a PDF survives the ascii filter (AMH-066)', () => {
  it('the PDF helper produces a clean, already-ASCII amount', () => {
    const out = formatCurrencyForPdf(150000);
    expect(out).toBe('Rs 1,50,000.00');
    expect(asciiPlain(out)).toBe(out); // nothing to strip
    expect(asciiRupeeMapped(out)).toBe(out); // nothing to double
    expect(out).not.toMatch(/Rs\.?\s+Rs/); // no doubled prefix
    expect(out).not.toMatch(/ {2}/); // no stray double space
  });

  it('and the old construction really did produce both broken forms', () => {
    // Non-vacuity: this is what the code used to do.
    const old = `Rs. ${formatCurrency(150000)}`;
    expect(asciiPlain(old)).toBe('Rs.  1,50,000'); // double space, symbol gone
    expect(asciiRupeeMapped(old)).toBe('Rs. Rs.1,50,000'); // doubled prefix
  });

  it('no generator builds an amount by prefixing formatCurrency', () => {
    const offenders: string[] = [];
    for (const f of pdfFiles) {
      for (const [i, line] of readFileSync(join(PDF_DIR, f), 'utf8').split('\n').entries()) {
        if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;
        if (/Rs\.?\s*\$\{\s*formatCurrency\s*\(/.test(line)) offenders.push(`${f}:${i + 1} ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no generator renders a ₹-bearing formatter into a base-font PDF', () => {
    // formatCurrency / formatCurrencyExact / formatCompactCurrency all emit ₹.
    const offenders: string[] = [];
    for (const f of pdfFiles) {
      for (const [i, line] of readFileSync(join(PDF_DIR, f), 'utf8').split('\n').entries()) {
        if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;
        if (/\b(formatCurrency|formatCurrencyExact|formatCompactCurrency)\s*\(/.test(line)) {
          offenders.push(`${f}:${i + 1} ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('a quantity is not money (AMH-066)', () => {
  it('formatQuantity carries no symbol and no forced decimals', () => {
    expect(formatQuantity(1200)).toBe('1,200'); // carpet area, sq.ft
    expect(formatQuantity(1200.5)).toBe('1,200.50'); // …with a half
    expect(formatQuantity(3)).toBe('3'); // a count of doors
    expect(formatQuantity(1234567)).toBe('12,34,567'); // Indian grouping
    expect(formatQuantity(null)).toBe('—');
    expect(formatQuantity(1200)).not.toContain('₹');
  });

  it('carpet area and invoice quantity no longer print a currency symbol', () => {
    // They used to: `${formatCurrency(d.carpetAreaSqft)} sq.ft` → "₹1,200 sq.ft".
    const cost = readFileSync(join(PDF_DIR, 'cost-sheet-pdf.ts'), 'utf8');
    expect(cost).toMatch(/formatQuantity\(d\.carpetAreaSqft\)/);
    const invoice = readFileSync(join(PDF_DIR, 'invoice-pdf.ts'), 'utf8');
    expect(invoice).toMatch(/formatQuantity\(it\.quantity\)/);
  });

  it('Tally rate and amount columns stay bare, per Tally convention', () => {
    const tally = readFileSync(join(PDF_DIR, 'tally-invoice-pdf.ts'), 'utf8');
    expect(tally).toMatch(/formatAmountPlain\(it\.rate\)/);
    expect(tally).toMatch(/formatAmountPlain\(it\.amount\)/);
    expect(formatAmountPlain(1200)).toBe('1,200.00');
  });
});
