import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { escapeCsvCell, csvRow, toCsv } from '@/lib/export/csv';

const read = (p: string) => readFileSync(p, 'utf8');

/**
 * AMH-060 — a spreadsheet cell that begins `= + - @` is a formula, and quoting
 * does not stop it: the quotes are consumed by the parser and what is left is
 * evaluated. The person who supplies the text is whoever can type a lead name,
 * a vendor name, a narration or a payment reference. The person who runs it is
 * the accountant who opens the export.
 */
describe('exports cannot smuggle a formula into a spreadsheet (AMH-060)', () => {
  it('neutralises every character a spreadsheet treats as a formula start', () => {
    for (const c of ['=', '+', '-', '@', '\t', '\r']) {
      expect(escapeCsvCell(`${c}HYPERLINK("http://evil.tld")`)).toBe(`"'${c}HYPERLINK(""http://evil.tld"")"`);
    }
  });

  it('leaves ordinary text readable', () => {
    expect(escapeCsvCell('Priya Sharma')).toBe('"Priya Sharma"');
    expect(escapeCsvCell(1500)).toBe('"1500"');
    expect(escapeCsvCell(null)).toBe('""');
  });

  /**
   * AMH-065 — the first version of this guard neutralised anything starting
   * `= + - @`, which is right for text and wrong for numbers.
   *
   * The apostrophe is Excel's "treat as text" marker when you TYPE into a
   * cell. On CSV *import* it is just a character. So `'-50000` arrived in the
   * accountant's Balance column left-aligned, SUM over it returned 0, and
   * every chart on that column came out empty. The cash book's running balance
   * goes negative the moment a month opens with a payment, so this was not an
   * edge case — it was most months.
   *
   * The phone case is worse than cosmetic: bulk-import reads the phone column
   * back verbatim, so an export/re-import round trip permanently corrupted the
   * number and broke the `tel:` link on that lead.
   */
  it('does not corrupt a negative amount or a phone number', () => {
    expect(escapeCsvCell(-50000)).toBe('"-50000"');
    expect(escapeCsvCell('-50000')).toBe('"-50000"');
    expect(escapeCsvCell('-1,25,000.50')).toBe('"-1,25,000.50"');
    expect(escapeCsvCell('+91 98404 90000')).toBe('"+91 98404 90000"');
    expect(escapeCsvCell('+919840490000')).toBe('"+919840490000"');
  });

  it('but anything that is not plainly a number is still neutralised', () => {
    for (const payload of ['-1+1', '-cmd', '+CMD|calc', '@SUM(A1)', '=1+1', '-', '+', '-1e3;x']) {
      expect(escapeCsvCell(payload)).toBe(`"'${payload}"`);
    }
  });

  it('quotes are doubled, so a cell cannot break out of its column', () => {
    expect(csvRow(['a"b', 'c,d'])).toBe('"a""b","c,d"');
    expect(toCsv([{ x: '=1+1', y: 'ok' }])).toBe('"x","y"\n"\'=1+1","ok"');
  });

  it('no exporter in the codebase rolls its own quote-only escaper', () => {
    // The signature of the bug: a template literal that wraps a value in quotes
    // and doubles inner quotes, with no formula guard. One shared helper now,
    // so this pattern reappearing means somebody has re-introduced the hole.
    const offenders: string[] = [];
    const rollYourOwn = /`""\$\{[^}]*\.replace\(\/"\/g, '""'\)\}""`|\.replace\(\/"\/g, '""'\)/;
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!/\.tsx?$/.test(p)) continue;
        if (p.endsWith('lib/export/csv.ts')) continue; // the one place it belongs
        // The file-format converter is deliberately exempt: the person who
        // supplies the spreadsheet is the person who downloads the CSV, so
        // there is no second victim — and neutralising formulas there would
        // silently corrupt a sheet somebody asked us to convert, not protect
        // anyone.
        if (p.endsWith('lib/tools/convert.ts')) continue;
        const src = read(p);
        if (!/csv|Csv|CSV/.test(src)) continue;
        if (rollYourOwn.test(src)) offenders.push(p);
      }
    };
    walk('src');
    expect(offenders).toEqual([]);
  });
});

/**
 * AMH-061 — the drip-sequence template is written by staff; the values merged
 * into it are not. `name` is a lead name, and a lead can be created through the
 * ingest APIs by anyone holding a key.
 */
describe('a lead name cannot author an outbound email (AMH-061)', () => {
  const src = read('src/server/services/sequence-service.ts');

  it('the HTML copy escapes merged values', () => {
    expect(src).toMatch(/function mergeHtml\(/);
    expect(src).toMatch(/escapeHtml\(vars\[k\] \?\? ''\)/);
    // The HTML body is built from mergeHtml, not from the plain-text merge.
    expect(src).toMatch(/const htmlBody = mergeHtml\(step\.body, vars\)/);
    expect(src).toMatch(/htmlBody\.split\('\\n'\)/);
  });

  it('and a newline in a merged value cannot split the subject header', () => {
    expect(src).toMatch(/const oneLine = /);
    const subjectLine = src.split('\n').find((l) => l.includes('const subject = merge('));
    expect(subjectLine).toBeDefined();
    expect(subjectLine!).toMatch(/oneLine/);
  });

  it('escapeHtml really neutralises a tag, so the above is worth asserting', async () => {
    const { escapeHtml } = await import('@/lib/email/escape');
    const payload = 'Priya</p><p><a href="https://evil.tld">Pay here</a>';
    const out = escapeHtml(payload);
    expect(out).not.toContain('<a');
    expect(out).not.toContain('</p>');
    expect(out).toContain('Priya');
  });
});
