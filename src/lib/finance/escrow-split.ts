/**
 * RERA 70/30 escrow split (module #50). Under RERA s.4(2)(l)(D) 70% of every
 * buyer collection must sit in the project's designated escrow account and may
 * only be drawn against certified construction progress; the remaining 30% is
 * free (land + marketing + margin). This helper is the single source of truth
 * for that arithmetic so the webhook worker and any UI preview agree to the paisa.
 *
 * Rupee-integer in, rupee-integer out. The two legs always re-sum to the input
 * exactly (no rounding leak): the general leg absorbs the rounding remainder.
 */
export interface EscrowSplit {
  rera: number;    // 70% — locked in the RERA escrow account
  general: number; // 30% — freely usable
  total: number;
}

export function splitEscrow(amount: number): EscrowSplit {
  const total = Math.max(0, Math.round(Number.isFinite(amount) ? amount : 0));
  const rera = Math.round(total * 0.7);
  const general = total - rera; // remainder-absorbing: rera + general === total, always
  return { rera, general, total };
}
