import { describe, it, expect } from 'vitest';
import { analyseHead, checkCommitment, forecast, rollUp } from '@/lib/budget/variance';
import { COST_CODES } from '@/config/cost-codes';

const head = (over: Partial<Parameters<typeof analyseHead>[0]> = {}) =>
  analyseHead({ costCode: 'S-40', name: 'Steel', budget: 10000000, committed: 0, incurred: 0, paid: 0, ...over });

describe('the cost code tree holds together', () => {
  it('has no duplicate codes', () => {
    const codes = COST_CODES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('every parent exists and is a heading', () => {
    const by = new Map(COST_CODES.map((c) => [c.code, c]));
    for (const c of COST_CODES) {
      if (!c.parent) continue;
      expect(by.get(c.parent), `${c.code} has a missing parent`).toBeDefined();
      expect(by.get(c.parent)!.isGroup, `${c.code}'s parent takes budget itself`).toBe(true);
    }
  });

  it('only leaf codes carry an account, since only they take postings', () => {
    for (const c of COST_CODES) {
      if (c.isGroup) expect(c.accountCode, `${c.code} is a heading but names an account`).toBeUndefined();
      else expect(c.accountCode, `${c.code} takes budget but names no account`).toBeDefined();
    }
  });
});

describe('analyseHead', () => {
  it('counts committed and incurred together as exposure', () => {
    const h = head({ committed: 3000000, incurred: 2000000, paid: 1500000 });
    expect(h.exposure).toBe(5000000);
    expect(h.remaining).toBe(5000000);
    expect(h.usedPct).toBe(50);
    expect(h.overBudget).toBe(false);
  });

  it('does not treat paid as exposure — money paid is already inside incurred', () => {
    const h = head({ committed: 0, incurred: 4000000, paid: 4000000 });
    expect(h.exposure).toBe(4000000);
  });

  it('spots an overspend and sizes it', () => {
    const h = head({ committed: 6000000, incurred: 6000000 });
    expect(h.overBudget).toBe(true);
    expect(h.variance).toBe(2000000);
    expect(h.variancePct).toBe(20);
  });

  it('asks for an explanation only when the variance is both large and material', () => {
    // 20% of 1 crore — big both ways.
    expect(head({ incurred: 12000000 }).needsExplanation).toBe(true);
    // 20% of a ₹40,000 head is ₹8,000. Proportionally alarming, actually trivial.
    expect(analyseHead({ costCode: 'x', name: 'Small', budget: 40000, committed: 0, incurred: 48000, paid: 0 }).needsExplanation).toBe(false);
    // ₹2 lakh over on a ₹20 crore head is large in rupees but 0.1%.
    expect(analyseHead({ costCode: 'y', name: 'Big', budget: 200000000, committed: 0, incurred: 200200000, paid: 0 }).needsExplanation).toBe(false);
  });

  it('handles a head with no budget without dividing by zero', () => {
    const h = analyseHead({ costCode: 'z', name: 'Unbudgeted', budget: 0, committed: 0, incurred: 50000, paid: 0 });
    expect(Number.isFinite(h.usedPct)).toBe(true);
    expect(h.usedPct).toBe(100);
    expect(h.variancePct).toBe(0);
  });

  it('handles an untouched head', () => {
    const h = head();
    expect(h.usedPct).toBe(0);
    expect(h.remaining).toBe(10000000);
  });
});

describe('checkCommitment', () => {
  it('allows an order that fits', () => {
    const v = checkCommitment(head({ incurred: 2000000 }), 1000000);
    expect(v.allowed).toBe(true);
    expect(v.message).toBeNull();
    expect(v.remainingAfter).toBe(7000000);
  });

  it('warns but still allows when it does not fit', () => {
    const v = checkCommitment(head({ incurred: 9500000 }), 1000000);
    expect(v.allowed).toBe(true);
    expect(v.blocked).toBe(false);
    expect(v.message).toContain('over budget');
  });

  it('blocks only when asked to', () => {
    const v = checkCommitment(head({ incurred: 9500000 }), 1000000, { hardBlock: true });
    expect(v.allowed).toBe(false);
    expect(v.blocked).toBe(true);
  });

  it('says so plainly when there is no budget to check against', () => {
    const v = checkCommitment(analyseHead({ costCode: 'z', name: 'Unbudgeted', budget: 0, committed: 0, incurred: 0, paid: 0 }), 5000);
    expect(v.message).toContain('no budget set');
  });

  it('allows an order that lands exactly on the budget', () => {
    expect(checkCommitment(head({ incurred: 9000000 }), 1000000).allowed).toBe(true);
    expect(checkCommitment(head({ incurred: 9000000 }), 1000000).remainingAfter).toBe(0);
  });
});

describe('forecast', () => {
  it('shows the honest number when spend is running ahead of progress', () => {
    // 40% built, 60% of budget already committed.
    const f = forecast(head({ incurred: 6000000 }), 40);
    expect(f.atCompletion).toBe(10000000);      // trusting the budget
    expect(f.atCurrentRate).toBe(15000000);     // trusting the run rate
    expect(f.atCurrentRate!).toBeGreaterThan(f.atCompletion);
  });

  it('does not divide by zero before work starts', () => {
    expect(forecast(head(), 0).atCurrentRate).toBeNull();
  });

  it('never reports a negative cost to complete', () => {
    expect(forecast(head({ incurred: 12000000 }), 100).costToComplete).toBe(0);
  });
});

describe('rollUp', () => {
  it('adds the heads and counts the overspends', () => {
    const r = rollUp([
      head({ budget: 10000000, incurred: 4000000, paid: 4000000 }),
      head({ budget: 5000000, committed: 6000000 }),
    ]);
    expect(r.budget).toBe(15000000);
    expect(r.exposure).toBe(10000000);
    expect(r.remaining).toBe(5000000);
    expect(r.overCount).toBe(1);
  });

  it('does not drift over many heads', () => {
    const heads = Array.from({ length: 500 }, () =>
      analyseHead({ costCode: 'x', name: 'x', budget: 33333.33, committed: 11111.11, incurred: 11111.11, paid: 0 }));
    const r = rollUp(heads);
    expect(r.budget).toBe(16666665);
    expect(r.exposure).toBe(11111110);
  });
});
