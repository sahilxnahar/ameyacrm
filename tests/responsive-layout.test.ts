import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the two layout habits that made the CRM look wrong on a 13" laptop.
 *
 * Neither of them overflows the page, which is why they survived so long: a
 * scan for horizontal scrollbars comes back clean and everything still "fits".
 * They just stop lining up, and that reads to a person as the app being badly
 * built. Both are one-line mistakes that are very easy to reintroduce, so they
 * are checked here rather than left to review.
 */

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(p)) out.push(p);
  }
  return out;
}

const ROOT = join(__dirname, '..', 'src');
const FILES = walk(ROOT).map((path) => ({ path: path.slice(ROOT.length + 1), src: readFileSync(path, 'utf8') }));

describe('responsive layout', () => {
  it('has files to check', () => {
    expect(FILES.length).toBeGreaterThan(100);
  });

  /**
   * `justify-between` justifies each LINE of a wrapped flex row on its own. So a
   * "description on the left, buttons on the right" header is correct until it
   * wraps — and on a 13" screen it wraps constantly — at which point the buttons
   * snap to the LEFT edge and sit misaligned under the text. `.toolbar` puts an
   * auto start-margin on the last child instead, which is right in both states.
   */
  it('never combines flex-wrap with justify-between', () => {
    const bad = FILES.filter((f) => /flex-wrap[^"']*justify-between|justify-between[^"']*flex-wrap/.test(f.src))
      .map((f) => f.path);
    expect(bad, `Use "toolbar" instead of "flex flex-wrap … justify-between" in:\n${bad.join('\n')}`).toEqual([]);
  });

  /**
   * Tailwind's `xl` is exactly 1280px — the width of a 13" laptop — so
   * `lg:grid-cols-2 xl:grid-cols-4` switched four summary cards from half-width
   * to quarter-width at the precise width where there was least room, and gave
   * everything from 1024 to 1279 two enormous cards. `.stat-grid` sizes on
   * content, so there is no cliff at any width.
   */
  it('sizes summary-card rows on content, not on breakpoints', () => {
    const bad = FILES.filter((f) => /lg:grid-cols-2\s+xl:grid-cols-4/.test(f.src)).map((f) => f.path);
    expect(bad, `Use "stat-grid" instead of a lg:2 → xl:4 jump in:\n${bad.join('\n')}`).toEqual([]);
  });

  /**
   * A fixed pixel width on a form control cannot shrink, so on a 390px phone it
   * is the one element that pushes the page sideways. Fixed widths are fine
   * behind a breakpoint (`sm:w-72`), which is what the exception allows.
   */
  it('does not give form controls an unconditional fixed width', () => {
    const bad: string[] = [];
    for (const f of FILES) {
      for (const m of f.src.matchAll(/className="([^"]*\b(?:input|select)\b[^"]*)"/gi)) {
        const cls = m[1] ?? '';
        if (/(?<![:\w-])w-(?:6[4-9]|7[0-9]|8[0-9]|9[0-6])\b/.test(cls) && !/\bw-full\b/.test(cls)) {
          bad.push(`${f.path}: ${cls.slice(0, 80)}`);
        }
      }
    }
    expect(bad, `Give these a fluid width with a breakpoint override:\n${bad.join('\n')}`).toEqual([]);
  });

  /** The utilities the rules above point people at have to actually exist. */
  it('defines the layout utilities it recommends', () => {
    const css = readFileSync(join(ROOT, 'app', 'globals.css'), 'utf8');
    expect(css).toMatch(/\.toolbar\s*\{/);
    expect(css).toMatch(/\.toolbar\s*>\s*:last-child:not\(:only-child\)/);
    expect(css).toMatch(/\.stat-grid\s*\{/);
    expect(css).toMatch(/repeat\(auto-fit, minmax/);
    expect(css).toMatch(/\.nav-scroll\s*\{/);
  });
});
