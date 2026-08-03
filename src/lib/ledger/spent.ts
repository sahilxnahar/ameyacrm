/**
 * What counts as money actually spent.
 *
 * `cancelledAt: null` was the test everywhere, and it stopped being sufficient
 * the moment payments could be parked for approval: a DRAFT voucher is raised
 * but NOT approved, so nothing has left the bank. It is not cancelled either,
 * so every report that asked only "is it cancelled?" counted a ₹40,00,000
 * settlement nobody has approved as ₹40,00,000 spent — in the spend report, the
 * vendor's ledger, cost-to-complete, the TDS dashboard, and the vendor's own
 * portal, which told the vendor they had been paid.
 *
 * Spread this into a Prisma `where` on Voucher.
 */
export const SPENT = { status: 'POSTED' as const };

/**
 * The same idea where a query must also tolerate rows written before statuses
 * were used consistently: anything not cancelled and not awaiting approval.
 */
export const NOT_CANCELLED_OR_PENDING = {
  cancelledAt: null,
  status: { not: 'DRAFT' as const },
};
