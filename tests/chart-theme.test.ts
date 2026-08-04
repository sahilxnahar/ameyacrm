import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CATEGORICAL_LIGHT, CATEGORICAL_DARK, SEQUENTIAL_LIGHT, SEQUENTIAL_DARK,
  DIVERGING_LIGHT, DIVERGING_DARK, STATUS, categorical, seriesColor,
} from '../src/config/chart-theme';

/* ── OKLab, so the checks here are the same maths the palette was built with ── */
const srgb = (hex: string) => hex.replace('#', '').match(/../g)!.map((h) => {
  const v = parseInt(h, 16) / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
});
function oklab([r, g, b]: number[]) {
  const l = Math.cbrt(0.4122214708 * r! + 0.5363325363 * g! + 0.0514459929 * b!);
  const m = Math.cbrt(0.2119034982 * r! + 0.6806995451 * g! + 0.1073969566 * b!);
  const s = Math.cbrt(0.0883024619 * r! + 0.2817188376 * g! + 0.6299787005 * b!);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}
const dE = (a: string, b: string) => {
  const [l1, a1, b1] = oklab(srgb(a)); const [l2, a2, b2] = oklab(srgb(b));
  return Math.hypot(l1! - l2!, a1! - a2!, b1! - b2!) * 100;
};
const lum = (hex: string) => { const [r, g, b] = srgb(hex); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};
const LIGHT_SURFACE = '#FCFCFB';
const DARK_SURFACE = '#1B1A18';

/*
 * The old palettes were never wrong in a way anyone could see in a diff — they
 * were wrong in a way you only find by measuring. The reports chart used six
 * shades of brass whose worst adjacent pair sat at ΔE 3.8 for readers with
 * completely normal colour vision, which means a six-category chart was showing
 * fewer than six categories to everybody, for as long as it had existed.
 *
 * So the palette is pinned by measurement, not by eye. Anyone changing a hex in
 * chart-theme.ts has to keep it passing here.
 */
describe('chart palette holds up when measured', () => {
  for (const [name, palette, surface] of [
    ['light', CATEGORICAL_LIGHT, LIGHT_SURFACE],
    ['dark', CATEGORICAL_DARK, DARK_SURFACE],
  ] as const) {
    describe(name, () => {
      it('has eight fixed slots', () => {
        expect(palette).toHaveLength(8);
        expect(new Set(palette).size).toBe(8);
      });

      it('separates every adjacent pair for normal colour vision (ΔE ≥ 15)', () => {
        const bad: string[] = [];
        for (let i = 1; i < palette.length; i++) {
          const d = dE(palette[i - 1]!, palette[i]!);
          if (d < 15) bad.push(`${palette[i - 1]}↔${palette[i]} ΔE ${d.toFixed(1)}`);
        }
        expect(bad, `adjacent pairs too close: ${bad.join(', ')}`).toEqual([]);
      });

      it('clears 3:1 against its own surface', () => {
        const weak = palette
          .map((c) => [c, contrast(c, surface)] as const)
          .filter(([, r]) => r < 3)
          .map(([c, r]) => `${c} ${r.toFixed(2)}`);
        expect(weak, `too faint on ${surface}: ${weak.join(', ')}`).toEqual([]);
      });
    });
  }

  it('is not a flipped light palette — dark has its own steps', () => {
    // If dark were derived by inversion the two lists would share values.
    expect(CATEGORICAL_LIGHT.some((c) => (CATEGORICAL_DARK as readonly string[]).includes(c))).toBe(false);
  });

  it('keeps brass in slot one so a single-series chart is still an Ameya chart', () => {
    expect(seriesColor(0, 'light')).toBe(CATEGORICAL_LIGHT[0]);
    expect(categorical('light')[0]).toMatch(/^#A8751B$/i);
  });

  it('never invents a ninth colour', () => {
    // Nine categories cannot be told apart by anyone; wrapping is a quiet
    // degradation, not a feature. What it must NOT do is generate a new hue.
    expect((CATEGORICAL_LIGHT as readonly string[])).toContain(seriesColor(8, 'light'));
    expect((CATEGORICAL_LIGHT as readonly string[])).toContain(seriesColor(99, 'light'));
  });
});

describe('sequential and diverging do their own job', () => {
  it('sequential is one hue, monotonically light to dark', () => {
    const ls = SEQUENTIAL_LIGHT.map((c) => oklab(srgb(c))[0]!);
    expect(ls.every((v, i) => i === 0 || v < ls[i - 1]!), `not monotonic: ${ls.map((v) => v.toFixed(2))}`).toBe(true);
    const dk = SEQUENTIAL_DARK.map((c) => oklab(srgb(c))[0]!);
    expect(dk.every((v, i) => i === 0 || v > dk[i - 1]!)).toBe(true);
  });

  it('diverging has a neutral midpoint, not a third hue', () => {
    for (const ramp of [DIVERGING_LIGHT, DIVERGING_DARK]) {
      const mid = ramp[Math.floor(ramp.length / 2)]!;
      const [, a, b] = oklab(srgb(mid));
      expect(Math.hypot(a!, b!), `midpoint ${mid} is not neutral`).toBeLessThan(0.03);
    }
  });
});

describe('status colours stay reserved', () => {
  it('never doubles as a categorical series', () => {
    for (const mode of ['light', 'dark'] as const) {
      const overlap = Object.values(STATUS[mode]).filter((s) =>
        (categorical(mode) as readonly string[]).some((c) => c.toLowerCase() === s.toLowerCase()));
      expect(overlap, `status colour reused as a series: ${overlap.join(', ')}`).toEqual([]);
    }
  });
});

describe('no screen keeps its own private palette', () => {
  const files = [
    'src/components/reports/reports-charts.tsx',
    'src/components/dashboard/dashboard-charts.tsx',
    'src/components/analytics/analytics-view.tsx',
  ];
  it.each(files)('%s draws from the shared system', (f) => {
    const src = readFileSync(join(process.cwd(), f), 'utf8');
    expect(src).toContain('@/config/chart-theme');
    // A bare hex in a chart file is how four different palettes happened.
    const hexes = src.match(/['"]#[0-9A-Fa-f]{6}['"]/g) ?? [];
    expect(hexes, `hard-coded colours left behind: ${hexes.join(', ')}`).toEqual([]);
  });
});
