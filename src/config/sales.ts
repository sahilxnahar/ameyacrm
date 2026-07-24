import type { ApprovalTier } from '@/lib/sales/pricing';
import type { CommissionSlab } from '@/lib/sales/commission';

/**
 * Sales configuration — the discount approval matrix and the broker commission
 * slabs. Kept in code (not the database) because they are policy, changed rarely
 * and deliberately, and version-controlled changes to policy are an audit trail
 * in themselves. Adjust here and redeploy.
 */

/** Who may approve a discount, and up to what percentage of the gross price. */
export const DISCOUNT_APPROVAL_MATRIX: ApprovalTier[] = [
  { role: 'EXECUTIVE', maxDiscountPct: 2 },
  { role: 'MANAGER', maxDiscountPct: 5 },
  { role: 'DEPARTMENT_HEAD', maxDiscountPct: 8 },
  { role: 'ADMIN', maxDiscountPct: 12 },
  { role: 'SUPER_ADMIN', maxDiscountPct: 100 },
];

/** Default broker commission slabs by booking value (rupees). A channel
 *  partner's own `commissionPct` overrides the slab where it is set. */
export const COMMISSION_SLABS: CommissionSlab[] = [
  { fromValue: 0, ratePct: 1.5 },
  { fromValue: 5_000_000, ratePct: 2 },
  { fromValue: 10_000_000, ratePct: 2.5 },
  { fromValue: 20_000_000, ratePct: 3 },
];

/** TDS deducted at source on brokerage under section 194H. */
export const COMMISSION_TDS_PCT = 5;
