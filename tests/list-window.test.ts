import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { listWindow, listMeta, DEFAULT_WINDOW, MAX_WINDOW } from '../src/lib/list/page-window';

/*
 * The list layer, from the August 2026 audit (AMH-006).
 *
 * Counted: 290 `take:` clauses and ZERO `skip:`. There is no pagination in the
 * product. Every list fetches the first N rows and renders them with nothing on
 * screen saying there are more, so a partial answer is indistinguishable from a
 * complete one.
 *
 * The sharpest form of it: eleven screens passed `total: rows.length` into a
 * "Total" stat tile — literally displaying the truncated count as the total.
 * That is not a missing feature, it is a wrong number on the screen.
 */

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(root, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(root, rel)).isDirectory()) walk(rel, out);
    else if (rel.endsWith('.tsx')) out.push(rel);
  }
  return out;
}

describe('the window', () => {
  it('defaults to the screen’s own cap', () => {
    expect(listWindow(undefined, 300)).toEqual({ take: 300, showingAll: false });
    expect(listWindow({}, 300).take).toBe(300);
    expect(listWindow(undefined).take).toBe(DEFAULT_WINDOW);
  });

  it('opens up on ?rows=all', () => {
    expect(listWindow({ rows: 'all' }, 200)).toEqual({ take: MAX_WINDOW, showingAll: true });
  });

  it('is not unbounded even then', () => {
    // An unbounded fetch is how one person opening one screen takes the server
    // down — which is why the caps existed in the first place. The escape hatch
    // has to be bigger, not infinite.
    expect(MAX_WINDOW).toBeLessThanOrEqual(10_000);
    expect(MAX_WINDOW).toBeGreaterThan(DEFAULT_WINDOW);
  });

  it('ignores anything else in the query string', () => {
    // ?rows=99999 must not become a way to ask for the whole table.
    expect(listWindow({ rows: '99999' }, 200).take).toBe(200);
    expect(listWindow({ rows: ['all', 'x'] }, 200).take).toBe(MAX_WINDOW);
    expect(listWindow({ rows: 'ALL' }, 200).take).toBe(200);
  });
});

describe('what the reader is told', () => {
  it('says nothing when the list is complete', () => {
    // Equal counts, and one row fewer than the cap: both are complete.
    expect(listMeta(200, 200, listWindow(undefined, 200)).truncated).toBe(false);
    expect(listMeta(37, 37, listWindow(undefined, 200)).truncated).toBe(false);
  });

  it('says so when it is not', () => {
    const m = listMeta(200, 1340, listWindow(undefined, 200));
    expect(m).toMatchObject({ shown: 200, total: 1340, truncated: true, cappedAtMax: false });
  });

  it('distinguishes “there is more” from “there is more than this can ever show”', () => {
    // The advice differs. "Narrow the filters, or show all" is useless once
    // you have already asked for all of it.
    const asked = listWindow({ rows: 'all' }, 200);
    expect(listMeta(MAX_WINDOW, 9000, asked).cappedAtMax).toBe(true);
    expect(listMeta(MAX_WINDOW, MAX_WINDOW, asked).cappedAtMax).toBe(false);
  });
});

describe('no screen displays a truncated count as a total', () => {
  it('`total: rows.length` appears nowhere', () => {
    /*
     * Eleven pages did this: Title Vault, Khata Vault, Arbitration, IP
     * Registry, UAN Validator, Vendor Insolvency, Heir Mapper, NRI Gateway,
     * Land Conversion, Piece Rate, Structural Contracts, plus Vendor Registry.
     *
     * The tile said "Total 300" whether there were 300 or 3,000. Someone
     * reconciling a register against that number would have found it agreed
     * with the rows they could see, and concluded the register was complete.
     */
    const offenders: string[] = [];
    for (const file of walk('src/app')) {
      for (const m of read(file).matchAll(/(total|count):\s*(\w+)\.length/g)) {
        offenders.push(`${file}: ${m[0]}`);
      }
    }
    expect(offenders, `truncated counts shown as totals:\n${offenders.join('\n')}`).toEqual([]);
  });

  it('the totals now come from a COUNT with no take clause', () => {
    for (const page of ['title-vault', 'khata-vault', 'uan-validator', 'vendor-insolvency']) {
      const src = read(`src/app/(app)/${page}/page.tsx`);
      expect(src, `${page} has no unfiltered count`).toMatch(/\.count\(\)\.catch/);
    }
  });
});

describe('the screens where a missing row costs money or compliance', () => {
  /*
   * Not every list is equally dangerous. These are the ones where row 201 being
   * invisible has a consequence outside the software: a s.43B(h) disallowance,
   * unclaimed input credit, a blacklisted supplier who still looks clean, an
   * RA bill nobody certified.
   */
  const COVERED = [
    'msme-tracker', 'ra-bills', 'gstr-recon', 'vendor-registry', 'reminders',
    'title-vault', 'khata-vault', 'arbitration', 'ip-registry', 'uan-validator',
    'vendor-insolvency', 'heir-mapper', 'nri-gateway', 'land-conversion',
    'piece-rate', 'structural-contracts', 'plan-sanction',
  ];

  it.each(COVERED)('%s tells the reader when it is showing a partial list', (page) => {
    const src = read(`src/app/(app)/${page}/page.tsx`);
    expect(src).toContain('<ListNotice');
    expect(src).toContain('listWindow(await searchParams');
    // The window has to actually reach Prisma, or the notice is decoration.
    expect(src).toMatch(/take: win\.take/);
  });

  it('each notice counts the same rows the list fetched', () => {
    /*
     * The one way this fix can be worse than the bug: a COUNT whose WHERE
     * clause differs from the findMany's. It would then report a truncation
     * that is not there, or miss one that is, and the notice would be lying
     * about the lie.
     *
     * Every page covered here fetches its list unfiltered, so an unfiltered
     * count is the matching one. If a filtered list is ever added, this test is
     * the reminder that the count must carry the same filter.
     */
    for (const page of COVERED) {
      const src = read(`src/app/(app)/${page}/page.tsx`);
      const noticeArg = src.match(/listMeta\((\w+)\.length,\s*(\w+),\s*win\)/);
      expect(noticeArg, `${page}: could not find the listMeta call`).not.toBeNull();
      const totalVar = noticeArg![2]!;
      // …and that variable must be bound to a count, not to another array.
      // It must be bound in the destructuring right after the rows array, and
      // fed by a `.count(` — not by another findMany.
      expect(src, `${page}: ${totalVar} is not destructured next to the rows`)
        .toMatch(new RegExp(`\\[\\s*\\w+,\\s*${totalVar}\\b`));
      expect(src, `${page}: ${totalVar} is not fed by a count`).toMatch(/\.count\(/);
    }
  });
});

describe('wide tables can be reached on a phone (AMH-040)', () => {
  it('no raw <table> is left without a horizontal scroll container', () => {
    /*
     * The audit said twelve tables. Most were already fixed by the v16.9
     * responsive work — the shared <Table> primitive and the `.table-scroll`
     * utility both scroll. Four genuinely did not, and one of those
     * (bill-wise, min-w-[34rem] = 544px) was wider than a phone with nothing to
     * scroll it, so it pushed the WHOLE PAGE sideways rather than scrolling in
     * its own box.
     */
    const offenders: string[] = [];
    for (const file of walk('src')) {
      if (file.endsWith('ui/table.tsx') || file.endsWith('ui/responsive-table.tsx')) continue;
      const src = read(file);
      if (src.includes("from '@/components/ui/table'")) continue;
      for (const m of src.matchAll(/<table\b/g)) {
        const before = src.slice(Math.max(0, m.index - 500), m.index);
        if (/overflow-x|overflow-auto|table-scroll/.test(before)) continue;
        offenders.push(`${file}:${src.slice(0, m.index).split('\n').length}`);
      }
    }
    expect(offenders, `tables that cannot scroll sideways:\n${offenders.join('\n')}`).toEqual([]);
  });
});

/*
 * Sorting (AMH-032).
 *
 * Three sortable columns existed in the whole product, all in one file. The
 * reason this is in the same test file as the truncation work is that the two
 * are the same bug seen twice: a screen showing a window of the data, presented
 * as if it were the data.
 *
 * A client-side sort over the fetched window is WORSE than no sort. A truncated
 * list at least looks arbitrary; "sorted by value, largest first" looks
 * authoritative and is the largest of an arbitrary 500.
 */
describe('sorting happens in the database, not over the fetched window', () => {
  it('resolves a whitelisted key into an orderBy', async () => {
    const { resolveSort } = await import('../src/lib/list/sort');
    const spec = {
      columns: { name: { name: 'asc' }, amount: { amount: 'asc' } },
      fallback: 'name' as const,
    };
    expect(resolveSort({ sort: 'amount', dir: 'desc' }, spec))
      .toEqual({ key: 'amount', direction: 'desc', orderBy: { amount: 'desc' } });
  });

  it('inverts a nested relation ordering too', async () => {
    const { resolveSort } = await import('../src/lib/list/sort');
    const spec = { columns: { owner: { owner: { name: 'asc' } } }, fallback: 'owner' as const };
    expect(resolveSort({ sort: 'owner', dir: 'desc' }, spec).orderBy).toEqual({ owner: { name: 'desc' } });
  });

  it('inverts every element of a multi-key ordering', async () => {
    const { resolveSort } = await import('../src/lib/list/sort');
    const spec = { columns: { tower: [{ tower: 'asc' }, { code: 'asc' }] }, fallback: 'tower' as const };
    expect(resolveSort({ sort: 'tower', dir: 'desc' }, spec).orderBy)
      .toEqual([{ tower: 'desc' }, { code: 'desc' }]);
  });

  it('refuses a column the screen did not offer', async () => {
    /*
     * The key comes from the query string and lands in a Prisma orderBy. Left
     * unchecked, `?sort=passwordHash` orders by a column the screen chose not
     * to show — and the resulting row order leaks its values a bit at a time.
     */
    const { resolveSort } = await import('../src/lib/list/sort');
    const spec = { columns: { name: { name: 'asc' } }, fallback: 'name' as const };
    for (const evil of ['passwordHash', '__proto__', 'constructor', 'toString', '']) {
      expect(resolveSort({ sort: evil }, spec).key, `${evil} was accepted`).toBe('name');
    }
  });

  it('falls back rather than throwing on a stale bookmark', async () => {
    const { resolveSort } = await import('../src/lib/list/sort');
    const spec = { columns: { name: { name: 'asc' } }, fallback: 'name' as const, defaultDirection: 'desc' as const };
    expect(resolveSort({ sort: 'gone', dir: 'sideways' }, spec))
      .toEqual({ key: 'name', direction: 'desc', orderBy: { name: 'desc' } });
  });

  it('a heading link keeps the rest of the URL', async () => {
    const { sortHref } = await import('../src/lib/list/sort-href');
    // Losing ?rows=all on a sort would shrink the list back under the reader,
    // who would then be looking at the top of a window they had opened up.
    const href = sortHref({ key: 'name', direction: 'asc' }, 'amount', { rows: 'all', status: 'OPEN' });
    const q = new URLSearchParams(href.slice(1));
    expect(q.get('rows')).toBe('all');
    expect(q.get('status')).toBe('OPEN');
    expect(q.get('sort')).toBe('amount');
    expect(q.get('dir')).toBe('asc');
  });

  it('clicking the active column toggles it', async () => {
    const { sortHref } = await import('../src/lib/list/sort-href');
    const asc = sortHref({ key: 'amount', direction: 'asc' }, 'amount', {});
    expect(new URLSearchParams(asc.slice(1)).get('dir')).toBe('desc');
    const desc = sortHref({ key: 'amount', direction: 'desc' }, 'amount', {});
    expect(new URLSearchParams(desc.slice(1)).get('dir')).toBe('asc');
  });

  it('the Explorer sorts in Prisma and the table only renders links', () => {
    const page = read('src/app/(app)/reports/explorer/page.tsx');
    expect(page).toContain('resolveSort(sp');
    // The resolved orderBy has to reach the query, or the sort is theatre.
    expect(page).toMatch(/runExplorer\(ctx, entity, filters, 500, sort\.orderBy\)/); // ctx added by AMH-059

    const service = read('src/server/services/explorer-service.ts');
    // Every branch takes the caller's orderBy, with its old value as the default.
    expect((service.match(/orderBy: orderBy \?\? /g) ?? []).length).toBe(4);

    const view = read('src/components/reports/explorer-view.tsx');
    expect(view).toContain('SortableHeader');
    // No client-side re-sorting of the fetched rows.
    expect(view).not.toMatch(/rows\.(sort|toSorted)\(/);
  });

  it('the header announces the sort to a screen reader, not just with an arrow', () => {
    const src = read('src/components/ui/sortable-header.tsx');
    expect(src).toContain('aria-sort');
    expect(src).toMatch(/ascending/);
    expect(src).toMatch(/descending/);
    // The icon must not double-announce what aria-sort already says.
    expect(src).toMatch(/<Icon[\s\S]*?aria-hidden/);
  });
});
