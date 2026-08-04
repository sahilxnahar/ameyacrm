import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

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

/*
 * AMH-029 — 55 calls to location.reload() used as state management.
 *
 * The rest of the codebase already used router.refresh() — 136 files of it —
 * so these were the outliers, not the convention.
 *
 * What a full reload costs: the scroll position, every open filter and
 * accordion, a half-typed value in another panel, and about a second of white
 * screen while the whole bundle re-downloads and re-executes. router.refresh()
 * re-runs the server components and swaps the new HTML in. The server action
 * has already called revalidatePath, so the data is equally fresh either way.
 */
describe('a save refreshes the page rather than reloading the browser', () => {
  it('only the two legitimate hard reloads remain', () => {
    const offenders: string[] = [];
    for (const file of walk('src')) {
      const src = read(file);
      for (const m of src.matchAll(/location\.reload\(\)/g)) {
        const line = src.slice(0, m.index).split('\n').length;
        offenders.push(`${file}:${line}`);
      }
    }
    /*
     * Two survive on purpose, and both would be BROKEN by router.refresh():
     *
     *  - the PWA update banner, whose whole job is to activate a waiting
     *    service worker and pick up new JavaScript. refresh() swaps HTML into
     *    the same page, still running the old bundle — the user presses
     *    "Update" and stays on the version they were trying to leave.
     *  - the map's failure state, where the map library failed to initialise.
     *    There is no server data to re-fetch; the page's JS has to start again.
     */
    expect(offenders.sort()).toEqual([
      'src/components/map/map-view.tsx:191',
      'src/components/pwa/update-banner.tsx:78',
    ]);
  });

  it('every component that refreshes has a router to refresh with', () => {
    // The failure mode of a bulk edit like this is a `router.refresh()` inside
    // a component that never called useRouter — which typechecks only because
    // some other `router` is in scope.
    for (const file of walk('src')) {
      const src = read(file);
      // Strip comments first: a doc-comment EXAMPLE showing router.refresh()
      // is not a call, and flagging it sends the next person hunting for a bug
      // that is not there. (It flagged undo-toast.tsx on its first run.)
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      if (!/\brouter\.refresh\(\)/.test(code)) continue;
      expect(src, `${file} calls router.refresh() without useRouter`).toMatch(/useRouter/);
    }
  });
});
