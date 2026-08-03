/**
 * The Vendor fields the app actually uses, named explicitly.
 *
 * A bare `prisma.vendor.findMany()` asks Postgres for EVERY column in the
 * model. So the moment the code knows about a column the database has not got
 * yet — `isMsme`, `udyamNumber`, `msmeHasAgreement`, added in v16.4 — the query
 * fails with P2022 and takes its whole page down. That is what made "I cannot
 * add a bill" and "I cannot add to the vendor ledger" true at the same time:
 * `/billing` and the vendor detail view both read the full row, and the create
 * forms live inside them.
 *
 * Selecting explicitly means a column the database has not caught up on can
 * only break the feature that needs it, never the screen around it.
 */
export const VENDOR_CORE_SELECT = {
  id: true, name: true, gstin: true, pan: true, email: true, phone: true, address: true,
  bankAccountName: true, bankAccountNumber: true, bankIfsc: true, bankName: true,
  bankBranch: true, upiId: true, paymentNotes: true, isActive: true,
  createdAt: true, updatedAt: true,
} as const;

/** Just enough to show a vendor in a list or a picker. */
export const VENDOR_PICKER_SELECT = { id: true, name: true, isActive: true } as const;
