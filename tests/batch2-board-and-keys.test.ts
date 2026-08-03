import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

/*
 * These guard the four things batch 2 got wrong at least once while it was
 * being built. Each one is a shape in the source, not a rendered pixel — the
 * browser run covers the pixels; this covers the shape, so a later edit that
 * quietly undoes one of them fails here instead of in front of a person.
 */

describe('lead board', () => {
  const src = read('src/components/sales/lead-board.tsx');

  it('reads the dragged card from a ref, not from state', () => {
    // React state is only correct after a re-render. A drag that starts and
    // ends inside one frame read `null` and dropped the move on the floor.
    expect(src).toContain('draggingRef');
    expect(src).toMatch(/draggingRef\.current \?\? dragging/);
  });

  it('carries the card id in the drag payload as a last resort', () => {
    expect(src).toContain("dataTransfer.setData('text/plain'");
    expect(src).toContain("dataTransfer.getData('text/plain')");
  });

  it('rolls the card back when the server refuses the move', () => {
    // Two rollbacks: one for a rejected action, one for a thrown request.
    expect(src.match(/status: before/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('is built on the existing leads, not a second prospects table', () => {
    expect(src).toContain("from '@/server/actions/sales'");
    expect(src).toContain('moveLeadStage');
  });
});

describe('customise modes can always be abandoned', () => {
  it('the launchpad reverts to a snapshot on Escape', () => {
    const src = read('src/components/features/feature-explorer.tsx');
    expect(src).toContain('snapshot');
    expect(src).toMatch(/e\.key === 'Escape'/);
    expect(src).toContain('cancelEditing');
  });

  it('the sidebar leaves menu-customise mode on Escape', () => {
    // In that mode every link is inert. Without an Escape the menu reads as
    // frozen to anyone who opened it by accident.
    const src = read('src/components/layout/sidebar.tsx');
    expect(src).toMatch(/if \(!customising\) return;[\s\S]{0,400}Escape/);
  });

  it('the pin customiser closes on Escape', () => {
    const src = read('src/components/layout/nav-customiser.tsx');
    expect(src).toMatch(/e\.key === 'Escape'/);
  });
});

describe('nav customiser search', () => {
  const src = read('src/components/layout/nav-customiser.tsx');

  it('matches screens in the browser instead of per keystroke on the server', () => {
    expect(src).toContain('localTargets');
    expect(src).toContain("from '@/config/navigation'");
  });

  it('only asks the server after a real pause and at least two characters', () => {
    expect(src).toMatch(/q\.length < 2/);
    expect(src).toMatch(/\}, 400\)/);
  });

  it('never says "Nothing matched" while matches are on screen', () => {
    // The emptiness test has to look at what is actually listed, not at what
    // the server happened to return.
    expect(src).toMatch(/!searching && shown\.length === 0/);
    expect(src).not.toMatch(/!searching && results\.length === 0/);
  });

  it('stays reachable when the sidebar is collapsed to the icon rail', () => {
    // 1280px — a 13-inch laptop — is exactly the width the rail collapses at.
    expect(src).toContain('nav-label');
    expect(read('src/components/layout/sidebar.tsx')).toContain('lg:[&_.nav-label]:hidden');
  });
});

describe('per-key AI test', () => {
  const src = read('src/lib/ai/provider.ts');

  it('probes every key rather than stopping at the first that works', () => {
    expect(src).toContain('probeEveryKey');
    expect(src).toMatch(/for \(const \[i, key\] of pool\.entries\(\)\)/);
  });

  it('checks the backup provider and a direct Google key too', () => {
    expect(src).toContain('fallbackProvider()');
    expect(src).toContain('generativelanguage.googleapis.com');
  });

  it('reports a key by hint only, never the key itself', () => {
    expect(src).toContain('keyHint(');
    // No branch may put a raw key on the returned object.
    expect(src).not.toMatch(/hint:\s*key\s*[,}]/);
  });

  it('says in plain words how much runway is left', () => {
    expect(src).toContain('less runway than you think');
    expect(src).toContain('No AI keys are configured at all');
  });

  it('is only callable by someone who can manage settings', () => {
    expect(read('src/server/actions/vouchers.ts')).toMatch(
      /testEveryAiKey[\s\S]{0,300}admin\.setting\.manage/,
    );
  });
});
