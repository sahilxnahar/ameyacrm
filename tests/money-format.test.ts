import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { formatCurrency, formatCurrencyExact, formatCompactCurrency } from '../src/lib/utils/format';

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(rel)) out.push(rel);
  }
  return out;
}

/*
 * AMH-035 — money was written 28 different ways and they disagreed.
 *
 * Most files defined their own `const inr = …`. Measured before the change:
 *
 *     amount        canonical    local `inr`   2-decimal local
 *     150000.5      ₹1,50,001    ₹1,50,001     ₹1,50,000.50
 *     0.5           ₹1           ₹1            ₹0.50
 *     -2500.75      -₹2,501      ₹-2,501       ₹-2,500.75
 */
describe('paise are never silently rounded away', () => {
  it('fifty paise is not one rupee', () => {
    /*
     * The one that matters. At maximumFractionDigits: 0, two amounts differing
     * by up to 99 paise render IDENTICALLY — so a reconciliation screen shows
     * two equal-looking figures next to a difference column reading ₹0.50, and
     * the reader concludes the software is broken. On GSTR-2B matching that is
     * the column deciding whether input credit gets claimed.
     */
    expect(formatCurrency(0.5)).toBe('₹0.50');
    expect(formatCurrency(150000.5)).toBe('₹1,50,000.50');
    expect(formatCurrency(1234567.89)).toBe('₹12,34,567.89');
  });

  it('whole rupees stay clean', () => {
    // The reason not to just switch everything to two decimals: 99% of amounts
    // are whole, and ₹1,50,000.00 everywhere is noise that hides the exceptions.
    expect(formatCurrency(150000)).toBe('₹1,50,000');
    expect(formatCurrency(0)).toBe('₹0');
  });

  it('two amounts that differ render differently', () => {
    // The property, stated directly.
    expect(formatCurrency(1000)).not.toBe(formatCurrency(1000.5));
    expect(formatCurrency(99.99)).not.toBe(formatCurrency(100));
  });

  it('floating-point drift does not sprout decimals', () => {
    // 0.1 + 0.2 is 0.30000000000000004. Rounding to paise first means that is
    // ₹0.30, not a two-decimal render of a value that is "really" whole.
    expect(formatCurrency(0.1 + 0.2)).toBe('₹0.30');
    expect(formatCurrency(1.005 * 100)).toBe('₹100.50');
    expect(formatCurrency(3 * 0.3333333333)).toBe('₹1');
  });

  it('the sign goes in one place', () => {
    // Locals produced ₹-2,501; the canonical formatter produces -₹2,501.
    expect(formatCurrency(-2500.75)).toBe('-₹2,500.75');
    expect(formatCurrency(-150000)).toBe('-₹1,50,000');
  });

  it('handles the empty cases without printing NaN at somebody', () => {
    for (const v of [null, undefined, Number.NaN, Infinity, 'not a number']) {
      expect(formatCurrency(v as never)).toBe('—');
    }
  });

  it('accepts the strings Prisma Decimal columns arrive as', () => {
    expect(formatCurrency('150000.50')).toBe('₹1,50,000.50');
    expect(formatCurrency('150000')).toBe('₹1,50,000');
  });
});

describe('the exact formatter lines columns up', () => {
  it('always shows two decimals', () => {
    expect(formatCurrencyExact(150000)).toBe('₹1,50,000.00');
    expect(formatCurrencyExact(0.5)).toBe('₹0.50');
  });
});

describe('the compact formatter is for headlines only', () => {
  it('speaks crores and lakhs', () => {
    expect(formatCompactCurrency(15000000)).toBe('₹1.5 Cr');
    expect(formatCompactCurrency(150000)).toBe('₹1.5 L');
    expect(formatCompactCurrency(1500)).toBe('₹1.5k');
  });

  it('falls through to the exact formatter below a thousand', () => {
    // Nothing to compact, and this is where paise still matter.
    expect(formatCompactCurrency(500.5)).toBe('₹500.50');
  });
});

describe('screens do not roll their own', () => {
  it('no component defines a local rupee formatter', () => {
    /*
     * This is what let 28 formats exist: each file wrote the helper it needed.
     * The rule is not "never call toLocaleString" — it is that MONEY has one
     * formatter, so two screens showing the same figure show the same string.
     */
    const offenders: string[] = [];
    for (const file of walk('src')) {
      if (file.endsWith('lib/utils/format.ts')) continue;
      const src = read(file);
      for (const m of src.matchAll(/^const (inr|money|nf) = [^\n]*(?:toLocaleString\('en-IN'|Intl\.NumberFormat\('en-IN')[^\n]*$/gm)) {
        offenders.push(`${file}: ${m[0].trim().slice(0, 70)}`);
      }
    }
    expect(offenders, `local money formatters:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('nobody prints a second rupee sign in front of it', () => {
    // formatCurrency carries the symbol; the local helpers it replaced did not.
    // Getting this wrong renders ₹₹1,50,000.
    const offenders: string[] = [];
    for (const file of walk('src')) {
      const src = read(file);
      if (/₹\$?\{\s*format(Currency|CompactCurrency|CurrencyExact)\(/.test(src)) offenders.push(file);
    }
    expect(offenders, `doubled currency symbol:\n${offenders.join('\n')}`).toEqual([]);
  });
});
