/**
 * Three-way match, kept pure. Batch 6: the control that stops you paying for
 * material that never arrived. The purchase order says what was ordered, the
 * goods received note says what turned up, and the bill says what you are being
 * charged for — and the three should agree. Where they do not, this says how.
 */

export type MatchStatus =
  | 'MATCHED'
  | 'SHORT_RECEIVED' // received less than ordered
  | 'OVER_RECEIVED' // received more than ordered
  | 'OVER_BILLED' // billed for more than received
  | 'UNDER_BILLED'; // billed for less than received

export interface ThreeWayResult {
  status: MatchStatus;
  receivedVsOrdered: number;
  billedVsReceived: number;
  /** True only when everything lines up to tolerance — safe to pass for payment. */
  clean: boolean;
  /** Human summary of the discrepancy, or "" when clean. */
  detail: string;
}

/**
 * Compare ordered / received / billed quantities. `tolerance` (default 0.001)
 * absorbs rounding on fractional units (cft, tonnes). Over-billing is called out
 * first, because it is the one that costs money if it slips through.
 */
export function threeWayMatch(ordered: number, received: number, billed: number, tolerance = 0.001): ThreeWayResult {
  const receivedVsOrdered = Math.round((received - ordered) * 1000) / 1000;
  const billedVsReceived = Math.round((billed - received) * 1000) / 1000;

  let status: MatchStatus = 'MATCHED';
  let detail = '';
  if (billedVsReceived > tolerance) {
    status = 'OVER_BILLED';
    detail = `Billed for ${billedVsReceived} more than received.`;
  } else if (billedVsReceived < -tolerance) {
    status = 'UNDER_BILLED';
    detail = `Billed for ${-billedVsReceived} less than received.`;
  } else if (receivedVsOrdered < -tolerance) {
    status = 'SHORT_RECEIVED';
    detail = `Received ${-receivedVsOrdered} short of the order.`;
  } else if (receivedVsOrdered > tolerance) {
    status = 'OVER_RECEIVED';
    detail = `Received ${receivedVsOrdered} more than ordered.`;
  }

  return { status, receivedVsOrdered, billedVsReceived, clean: status === 'MATCHED', detail };
}
