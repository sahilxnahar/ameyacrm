import { describe, it, expect } from 'vitest';
import { parseCsv, rowsToMarkdown, rowsToJson } from '@/lib/tools/convert';

describe('parseCsv', () => {
  it('parses a simple grid', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('honours quoted fields with commas and newlines', () => {
    const grid = parseCsv('name,note\n"Doe, John","line1\nline2"');
    expect(grid).toEqual([['name', 'note'], ['Doe, John', 'line1\nline2']]);
  });

  it('handles escaped double-quotes', () => {
    expect(parseCsv('x\n"she said ""hi"""')).toEqual([['x'], ['she said "hi"']]);
  });

  it('treats CRLF as one row break and strips a BOM', () => {
    expect(parseCsv('﻿a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('rowsToMarkdown', () => {
  it('renders a GFM table with a header separator', () => {
    const md = rowsToMarkdown([['A', 'B'], ['1', '2']]);
    expect(md).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |\n');
  });

  it('escapes pipes and pads ragged rows', () => {
    const md = rowsToMarkdown([['A', 'B'], ['a|b']]);
    expect(md).toBe('| A | B |\n| --- | --- |\n| a\\|b |  |\n');
  });

  it('returns empty string for no rows', () => {
    expect(rowsToMarkdown([])).toBe('');
  });
});

describe('rowsToJson', () => {
  it('uses the first row as keys and skips blank rows', () => {
    expect(rowsToJson([['id', 'name'], ['1', 'Asha'], ['', '']])).toEqual([{ id: '1', name: 'Asha' }]);
  });

  it('names missing headers column_N', () => {
    expect(rowsToJson([['id', ''], ['1', 'x']])).toEqual([{ id: '1', column_2: 'x' }]);
  });
});
