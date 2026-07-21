import { describe, it, expect } from 'vitest';
import { analyseTitleChain, type ChainLink } from '@/lib/land/title-chain';

const link = (o: Partial<ChainLink> & { id: string }): ChainLink => ({
  id: o.id,
  kind: o.kind ?? 'SALE_DEED',
  title: o.title ?? o.id,
  chainOrder: o.chainOrder ?? 0,
  fromParty: o.fromParty ?? null,
  toParty: o.toParty ?? null,
  verified: o.verified ?? false,
});

describe('analyseTitleChain', () => {
  it('an empty chain is not clean and reports nothing', () => {
    const r = analyseTitleChain([]);
    expect(r.clean).toBe(false);
    expect(r.gaps).toHaveLength(0);
    expect(r.hasMotherDeed).toBe(false);
  });

  it('a continuous, verified chain with a mother deed is clean', () => {
    const r = analyseTitleChain([
      link({ id: 'a', kind: 'MOTHER_DEED', chainOrder: 0, fromParty: 'State', toParty: 'Rama', verified: true }),
      link({ id: 'b', chainOrder: 1, fromParty: 'Rama', toParty: 'Sita', verified: true }),
      link({ id: 'c', chainOrder: 2, fromParty: 'Sita', toParty: 'Ameya Heights', verified: true }),
    ]);
    expect(r.gaps).toHaveLength(0);
    expect(r.clean).toBe(true);
    expect(r.verifiedCount).toBe(3);
  });

  it('flags a break when a seller is not the previous buyer', () => {
    const r = analyseTitleChain([
      link({ id: 'a', kind: 'MOTHER_DEED', chainOrder: 0, fromParty: 'State', toParty: 'Rama', verified: true }),
      // Sold by Lakshman, but the parcel was transferred to Rama above.
      link({ id: 'b', chainOrder: 1, fromParty: 'Lakshman', toParty: 'Sita', verified: true }),
    ]);
    const broken = r.gaps.filter((g) => g.kind === 'BROKEN_CHAIN');
    expect(broken).toHaveLength(1);
    expect(broken[0]!.afterLinkId).toBe('a');
    expect(broken[0]!.beforeLinkId).toBe('b');
    expect(r.clean).toBe(false);
  });

  it('party comparison ignores case and surrounding space', () => {
    const r = analyseTitleChain([
      link({ id: 'a', kind: 'MOTHER_DEED', chainOrder: 0, fromParty: 'State', toParty: '  Rama Rao ', verified: true }),
      link({ id: 'b', chainOrder: 1, fromParty: 'rama rao', toParty: 'Sita', verified: true }),
    ]);
    expect(r.gaps).toHaveLength(0);
  });

  it('reports a missing mother deed as NO_ROOT', () => {
    const r = analyseTitleChain([
      link({ id: 'b', chainOrder: 1, fromParty: 'Rama', toParty: 'Sita', verified: true }),
    ]);
    expect(r.gaps.some((g) => g.kind === 'NO_ROOT')).toBe(true);
  });

  it('reports a link with no parties as unplaceable', () => {
    const r = analyseTitleChain([
      link({ id: 'a', kind: 'MOTHER_DEED', chainOrder: 0, fromParty: 'State', toParty: 'Rama' }),
      link({ id: 'b', chainOrder: 1, fromParty: null, toParty: null }),
    ]);
    expect(r.gaps.some((g) => g.kind === 'UNPLACEABLE_LINK' && g.beforeLinkId === 'b')).toBe(true);
  });

  it('still finds a break that spans a party-less middle link', () => {
    // Regression: a link with no parties must not hide a genuine break between
    // the placeable links on either side of it.
    const r = analyseTitleChain([
      link({ id: 'a', kind: 'MOTHER_DEED', chainOrder: 0, fromParty: 'State', toParty: 'Rama', verified: true }),
      link({ id: 'mid', chainOrder: 1, fromParty: null, toParty: null }), // party-less
      link({ id: 'c', chainOrder: 2, fromParty: 'Lakshman', toParty: 'Sita', verified: true }), // seller ≠ Rama
    ]);
    expect(r.gaps.some((g) => g.kind === 'UNPLACEABLE_LINK' && g.beforeLinkId === 'mid')).toBe(true);
    const broken = r.gaps.filter((g) => g.kind === 'BROKEN_CHAIN');
    expect(broken).toHaveLength(1);
    expect(broken[0]!.afterLinkId).toBe('a');
    expect(broken[0]!.beforeLinkId).toBe('c');
  });

  it('does not mutate the input array order', () => {
    const input = [
      link({ id: 'c', chainOrder: 2, fromParty: 'Sita', toParty: 'X', verified: true }),
      link({ id: 'a', kind: 'MOTHER_DEED', chainOrder: 0, fromParty: 'State', toParty: 'Rama', verified: true }),
      link({ id: 'b', chainOrder: 1, fromParty: 'Rama', toParty: 'Sita', verified: true }),
    ];
    const snapshot = input.map((l) => l.id);
    analyseTitleChain(input);
    expect(input.map((l) => l.id)).toEqual(snapshot);
  });
});
