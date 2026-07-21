import { describe, it, expect } from 'vitest';
import { escrowPosition, canWithdraw, covenantStatus, type EscrowMovementInput } from '@/lib/capital/escrow';

describe('escrowPosition', () => {
  it('requires 70% of receipts by default and flags a shortfall', () => {
    const p = escrowPosition(1_000_000, [{ kind: 'DEPOSIT', amount: 500_000 }], 0);
    expect(p.requiredDeposit).toBe(700_000);
    expect(p.deposited).toBe(500_000);
    expect(p.depositShortfall).toBe(200_000);
  });

  it('limits withdrawable to the certified share of what is deposited', () => {
    const movements: EscrowMovementInput[] = [{ kind: 'DEPOSIT', amount: 700_000 }];
    const p = escrowPosition(1_000_000, movements, 40); // 40% certified
    expect(p.withdrawable).toBe(280_000); // 40% of 700k
  });

  it('reduces withdrawable by what has already been withdrawn', () => {
    const movements: EscrowMovementInput[] = [
      { kind: 'DEPOSIT', amount: 700_000 },
      { kind: 'WITHDRAWAL', amount: 100_000 },
    ];
    const p = escrowPosition(1_000_000, movements, 40);
    expect(p.balance).toBe(600_000);
    expect(p.withdrawable).toBe(180_000); // 280k entitlement − 100k already out
  });

  it('flags over-withdrawal beyond the certified entitlement', () => {
    const movements: EscrowMovementInput[] = [
      { kind: 'DEPOSIT', amount: 700_000 },
      { kind: 'WITHDRAWAL', amount: 400_000 }, // > 40% of 700k = 280k
    ];
    const p = escrowPosition(1_000_000, movements, 40);
    expect(p.overWithdrawn).toBe(true);
  });
});

describe('canWithdraw', () => {
  const movements: EscrowMovementInput[] = [{ kind: 'DEPOSIT', amount: 700_000 }];
  const p = escrowPosition(1_000_000, movements, 40); // withdrawable 280k, balance 700k

  it('permits a withdrawal within the certified entitlement', () => {
    expect(canWithdraw(p, 200_000).ok).toBe(true);
  });
  it('refuses a withdrawal beyond the certified entitlement with a reason', () => {
    const r = canWithdraw(p, 300_000);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/certified/i);
  });
  it('refuses a withdrawal beyond the balance', () => {
    const empty = escrowPosition(1_000_000, [{ kind: 'DEPOSIT', amount: 100_000 }], 100);
    expect(canWithdraw(empty, 200_000).ok).toBe(false);
  });
  it('refuses a non-positive amount', () => {
    expect(canWithdraw(p, 0).ok).toBe(false);
  });
});

describe('covenantStatus', () => {
  it('breaches a MIN covenant when current falls below the threshold', () => {
    const s = covenantStatus({ name: 'DSCR', direction: 'MIN', threshold: 1.2, current: 1.1 });
    expect(s.breached).toBe(true);
    expect(s.headroom).toBeCloseTo(-0.1, 4);
  });
  it('breaches a MAX covenant when current rises above the threshold', () => {
    const s = covenantStatus({ name: 'LTV', direction: 'MAX', threshold: 65, current: 70 });
    expect(s.breached).toBe(true);
  });
  it('flags a near-breach within 5% of the threshold', () => {
    const s = covenantStatus({ name: 'DSCR', direction: 'MIN', threshold: 1.2, current: 1.23 });
    expect(s.breached).toBe(false);
    expect(s.nearBreach).toBe(true);
  });
  it('is comfortable well inside the threshold', () => {
    const s = covenantStatus({ name: 'DSCR', direction: 'MIN', threshold: 1.2, current: 2.0 });
    expect(s.breached).toBe(false);
    expect(s.nearBreach).toBe(false);
  });
});
