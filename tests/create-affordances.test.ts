import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * AMH-045, finished — a "New X" button has to land somewhere that can make an X.
 *
 * Reported from production: *"when I am trying to click new payments from the
 * menu, it's not working."* It was not a crash. "Record a payment" in the ＋
 * menu navigated to `/payments`, which is a read-only report of payments
 * already made — search, filters, CSV export, UTR editing, and no way to record
 * anything. The mobile FAB used the same label for `/ledgers`, a third page.
 * The person clicked, arrived at a list, and correctly concluded it was broken.
 *
 * The original AMH-045 fix added `?new=1` and applied it to exactly one item —
 * "New lead". The other five kept navigating to a page with the form shut,
 * which is indistinguishable from a button that does nothing. The dashboard's
 * "New task" link even passed `?new=1` to a page that never read it.
 *
 * Two rules, both cheap and both catching a real production bug:
 *   1. If a link passes `?new=`, the page it points at must read it.
 *   2. If a page reads `?new=`, something must actually link to it — otherwise
 *      the handler is dead code that will rot.
 */

const APP = 'src/app';

/** Directories that make up a route, so an href can be resolved to a page dir. */
function routeDirs(): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (dir: string, seg: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p, /^\(.*\)$/.test(e.name) ? seg : `${seg}/${e.name}`);
      else if (/^page\.(tsx|ts)$/.test(e.name)) map.set(seg === '' ? '/' : seg, dir);
    }
  };
  walk(APP, '');
  return map;
}

function allSources(dir = 'src'): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(p)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

/**
 * Follow a page into the client components it renders, one level of imports at
 * a time, and ask whether any of them reads the `new` search param. A page is a
 * server component; the state that opens a dialog lives in its child.
 */
function readsNewParam(pageDir: string): boolean {
  const pageFile = ['page.tsx', 'page.ts'].map((f) => join(pageDir, f)).find(existsSync);
  if (!pageFile) return false;
  const seen = new Set<string>();
  const queue = [pageFile];
  const looksLikeItReads = (src: string) =>
    /searchParams\.get\(['"]new['"]\)/.test(src) || /searchParams\??\.\bnew\b/.test(src);

  while (queue.length) {
    const f = queue.shift()!;
    if (seen.has(f) || !existsSync(f)) continue;
    seen.add(f);
    const src = readFileSync(f, 'utf8');
    if (looksLikeItReads(src)) return true;
    if (seen.size > 40) break; // depth guard
    for (const m of src.matchAll(/from\s+['"](@\/[^'"]+|\.\/[^'"]+)['"]/g)) {
      const spec = m[1]!;
      const base = spec.startsWith('@/') ? join('src', spec.slice(2)) : join(f, '..', spec);
      for (const ext of ['.tsx', '.ts']) if (existsSync(base + ext)) queue.push(base + ext);
    }
  }
  return false;
}

describe('every create affordance opens something (AMH-045)', () => {
  const routes = routeDirs();
  const sources = allSources();

  // Collect every internal link that carries a `?new=` parameter.
  const links: { file: string; line: number; href: string; path: string }[] = [];
  for (const f of sources) {
    for (const [i, line] of readFileSync(f, 'utf8').split('\n').entries()) {
      for (const m of line.matchAll(/["'`](\/[a-zA-Z0-9\-_/]*)\?new=([A-Za-z0-9_]+)["'`]/g)) {
        links.push({ file: f, line: i + 1, href: `${m[1]}?new=${m[2]}`, path: m[1]! });
      }
    }
  }

  it('found the links at all', () => {
    // Non-vacuity: if the scan finds nothing, everything below passes for free.
    expect(links.length).toBeGreaterThanOrEqual(4);
  });

  it('every ?new= link points at a route that exists', () => {
    const missing = links.filter((l) => !routes.has(l.path));
    expect(missing.map((m) => `${m.file}:${m.line} → ${m.href}`)).toEqual([]);
  });

  it('and at a page that actually reads the parameter', () => {
    // This is the bug: `/tasks?new=1` was linked from the dashboard for as long
    // as the dashboard has existed, and nothing on /tasks ever read `new`.
    const ignored = links.filter((l) => routes.has(l.path) && !readsNewParam(routes.get(l.path)!));
    expect(ignored.map((m) => `${m.file}:${m.line} → ${m.href}`)).toEqual([]);
  });

  it('"Record a payment" points at the page that owns createVoucher', () => {
    /*
     * Named explicitly because this is the one that was reported from
     * production, and because the destination is not obvious: recording a
     * payment lives on the cash book, not on /payments or /ledgers.
     */
    const owner = sources.find((f) => f.includes('cashbook/cash-book-view') );
    expect(owner).toBeDefined();
    expect(readFileSync(owner!, 'utf8')).toMatch(/createVoucher\(/);

    for (const f of ['src/components/layout/new-button.tsx', 'src/components/layout/mobile-fab.tsx', 'src/app/(app)/today/page.tsx']) {
      const src = readFileSync(f, 'utf8');
      const line = src.split('\n').find((l) => /Record a payment/.test(l));
      expect(line, `${f} has no "Record a payment" entry`).toBeDefined();
      expect(line!, `${f} still points somewhere that cannot record a payment`).toMatch(/\/cash-book\?new=/);
    }
  });

  it('the cash book only opens a voucher kind it recognises', () => {
    // `?new=` comes from the URL, so anyone can type it. It must not be able to
    // open a dialog for a kind that does not exist, or for a user who cannot
    // record vouchers at all.
    const src = readFileSync('src/components/cashbook/cash-book-view.tsx', 'utf8');
    expect(src).toMatch(/VOUCHER_KINDS as readonly string\[\]\)\.includes\(kind\)/);
    expect(src).toMatch(/canManage &&/);
  });
});
