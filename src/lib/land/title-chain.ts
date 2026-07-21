/**
 * Title-chain analysis, kept pure so it can be tested without a database.
 *
 * A title chain is the sequence of documents that carries ownership of a parcel
 * from the earliest recorded owner (the mother deed) down to the present holder.
 * The single most valuable thing this can do is make a *gap* visible as a gap —
 * a break where the person who sold in one link is not the person who was said
 * to own it in the previous one. A buyer's lawyer finds these. It is much
 * cheaper to find them first.
 *
 * Everything here works on plain data and a caller-supplied comparison, with no
 * dates constructed inside — the timezone lesson from the handover applies: a
 * function that builds its own `new Date()` is a function that behaves
 * differently in the test sandbox than in production.
 */

export interface ChainLink {
  id: string;
  kind: string;
  title: string;
  chainOrder: number;
  fromParty: string | null;
  toParty: string | null;
  verified: boolean;
}

export type TitleGapKind =
  /** The `toParty` of one link does not match the `fromParty` of the next. */
  | 'BROKEN_CHAIN'
  /** A link carries no parties at all, so it cannot be placed in the sequence. */
  | 'UNPLACEABLE_LINK'
  /** No mother deed at the head of the chain. */
  | 'NO_ROOT';

export interface TitleGap {
  kind: TitleGapKind;
  afterLinkId: string | null;
  beforeLinkId: string | null;
  detail: string;
}

export interface TitleChainAnalysis {
  links: ChainLink[];
  gaps: TitleGap[];
  /** Every link verified and no gaps. The only state a buyer's lawyer waves through. */
  clean: boolean;
  verifiedCount: number;
  hasMotherDeed: boolean;
}

/** Names match when they are the same once case and surrounding space are ignored. */
function sameParty(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Order the links, then walk them looking for breaks.
 *
 * Links are sorted by `chainOrder` and never mutated. Two adjacent links are
 * consistent when the earlier one's `toParty` is the later one's `fromParty`;
 * anything else is a break worth surfacing. A link with neither party set is
 * reported on its own rather than silently swallowing the neighbour comparison.
 */
export function analyseTitleChain(input: ChainLink[]): TitleChainAnalysis {
  const links = [...input].sort((a, b) =>
    a.chainOrder - b.chainOrder || a.title.localeCompare(b.title),
  );
  const gaps: TitleGap[] = [];

  const hasMotherDeed = links.some((l) => l.kind === 'MOTHER_DEED');
  if (links.length > 0 && !hasMotherDeed) {
    gaps.push({
      kind: 'NO_ROOT',
      afterLinkId: null,
      beforeLinkId: links[0]!.id,
      detail: 'No mother deed at the root of the chain — the earliest ownership is unproven.',
    });
  }

  // Report links that carry no party at all — they cannot sit anywhere in the
  // sequence — and set them aside so the adjacency walk runs over the links that
  // can be placed. Comparing only placeable links means a party-less link in the
  // middle cannot hide a genuine break that spans across it.
  const placeable: ChainLink[] = [];
  for (const link of links) {
    if (!link.fromParty && !link.toParty) {
      gaps.push({
        kind: 'UNPLACEABLE_LINK',
        afterLinkId: null,
        beforeLinkId: link.id,
        detail: `"${link.title}" records neither a seller nor a buyer, so it cannot be placed in the chain.`,
      });
    } else {
      placeable.push(link);
    }
  }

  for (let i = 0; i < placeable.length - 1; i++) {
    const link = placeable[i]!;
    const next = placeable[i + 1]!;
    if (link.toParty && next.fromParty && !sameParty(link.toParty, next.fromParty)) {
      gaps.push({
        kind: 'BROKEN_CHAIN',
        afterLinkId: link.id,
        beforeLinkId: next.id,
        detail: `"${link.title}" transfers to ${link.toParty}, but "${next.title}" is transferred by ${next.fromParty}. The chain does not join here.`,
      });
    }
  }

  const verifiedCount = links.filter((l) => l.verified).length;
  return {
    links,
    gaps,
    clean: links.length > 0 && gaps.length === 0 && verifiedCount === links.length,
    verifiedCount,
    hasMotherDeed,
  };
}
