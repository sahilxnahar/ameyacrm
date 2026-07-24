import { describe, it, expect } from 'vitest';
import { parseFlags, flagEnabled } from '@/lib/flags/flags';

describe('parseFlags', () => {
  it('returns an empty set for empty or missing input', () => {
    expect(parseFlags(undefined).size).toBe(0);
    expect(parseFlags(null).size).toBe(0);
    expect(parseFlags('').size).toBe(0);
  });

  it('splits on commas and whitespace and lowercases', () => {
    const s = parseFlags('live-updates, Command-Palette  instant-search');
    expect(s.has('live-updates')).toBe(true);
    expect(s.has('command-palette')).toBe(true);
    expect(s.has('instant-search')).toBe(true);
    expect(s.size).toBe(3);
  });

  it('ignores stray separators', () => {
    expect(parseFlags(',,  , live-updates ,').size).toBe(1);
  });
});

describe('flagEnabled', () => {
  it('answers against the parsed set', () => {
    const s = parseFlags('live-updates');
    expect(flagEnabled(s, 'live-updates')).toBe(true);
    expect(flagEnabled(s, 'command-palette')).toBe(false);
  });
});
