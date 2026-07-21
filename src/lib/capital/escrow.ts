/**
 * RERA escrow arithmetic and loan-covenant monitoring, kept pure and in whole
 * rupees so they can be tested without a database.
 *
 * RERA requires that 70% of the money received from buyers sits in a designated
 * account and is withdrawn only in proportion to certified construction
 * progress. Getting this wrong is a regulatory problem, not an accounting one,
 * so the two numbers that matter — how much *should* be in escrow, and how much
 * may still be withdrawn — are computed here and nowhere else.
 */

export interface EscrowMovementInput {
  kind: 'DEPOSIT' | 'WITHDRAWAL';
  amount: number;
}

export interface EscrowPosition {
  /** Total received from buyers. */
  totalReceipts: number;
  /** The escrow percentage in force (70 by default). */
  escrowPct: number;
  /** escrowPct% of receipts — what the designated account should hold in total. */
  requiredDeposit: number;
  deposited: number;
  withdrawn: number;
  balance: number;
  /** requiredDeposit − deposited, when positive: the account is under-funded and
   *  a deposit is owed. */
  depositShortfall: number;
  /** How much may still be withdrawn: certified share of what has been deposited,
   *  less what is already out. Never negative. */
  withdrawable: number;
  /** True when withdrawals have already exceeded the certified entitlement — a
   *  breach to flag loudly. */
  overWithdrawn: boolean;
}

const r2 = (n: number) => Math.round(n * 100) / 100;
const clampPct = (p: number) => Math.min(100, Math.max(0, p));

/**
 * Compute the escrow position.
 *
 * `certifiedPct` is the architect/engineer-certified completion percentage; a
 * developer may draw down escrow only in that proportion. The entitlement is
 * taken against what has actually been deposited, so a developer cannot withdraw
 * against money they never ring-fenced.
 */
export function escrowPosition(
  totalReceipts: number,
  movements: EscrowMovementInput[],
  certifiedPct: number,
  escrowPct = 70,
): EscrowPosition {
  const deposited = movements.filter((m) => m.kind === 'DEPOSIT').reduce((s, m) => s + m.amount, 0);
  const withdrawn = movements.filter((m) => m.kind === 'WITHDRAWAL').reduce((s, m) => s + m.amount, 0);
  const requiredDeposit = totalReceipts * (escrowPct / 100);
  const entitlement = deposited * (clampPct(certifiedPct) / 100);
  const withdrawable = Math.max(0, entitlement - withdrawn);

  return {
    totalReceipts: r2(totalReceipts),
    escrowPct,
    requiredDeposit: r2(requiredDeposit),
    deposited: r2(deposited),
    withdrawn: r2(withdrawn),
    balance: r2(deposited - withdrawn),
    depositShortfall: r2(Math.max(0, requiredDeposit - deposited)),
    withdrawable: r2(withdrawable),
    overWithdrawn: withdrawn > entitlement + 0.005,
  };
}

/**
 * Whether a proposed withdrawal is permitted, with a reason when it is not.
 * The certify path is expected to consult this before recording a WITHDRAWAL.
 */
export function canWithdraw(position: EscrowPosition, amount: number): { ok: boolean; reason: string | null } {
  if (amount <= 0) return { ok: false, reason: 'Enter a positive amount.' };
  if (amount > position.balance + 0.005) return { ok: false, reason: `Only ${position.balance} is in the escrow account.` };
  if (amount > position.withdrawable + 0.005) {
    return { ok: false, reason: `Certified progress permits only ${position.withdrawable} to be withdrawn right now.` };
  }
  return { ok: true, reason: null };
}

// ── Loan covenants ───────────────────────────────────────────────────────────

export interface CovenantInput {
  name: string;
  direction: 'MIN' | 'MAX';
  threshold: number;
  current: number;
}

export interface CovenantStatus extends CovenantInput {
  breached: boolean;
  /** Distance from the threshold in the safe direction; negative means breached.
   *  For MIN: current − threshold. For MAX: threshold − current. */
  headroom: number;
  /** Within 5% of the threshold on the wrong side of comfortable. */
  nearBreach: boolean;
}

export function covenantStatus(c: CovenantInput): CovenantStatus {
  const headroom = c.direction === 'MIN' ? c.current - c.threshold : c.threshold - c.current;
  const breached = headroom < 0;
  const band = Math.abs(c.threshold) * 0.05;
  const nearBreach = !breached && headroom <= band;
  return { ...c, breached, headroom: Math.round(headroom * 10000) / 10000, nearBreach };
}
