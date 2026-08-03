import type { DraftLine } from './entry';

/**
 * How each kind of document turns into a pair of ledger lines.
 *
 * Pure, so every rule can be tested without a database. The rules are the part
 * of an accounting system people get wrong most often, and the errors are quiet:
 * a payment booked to the wrong head still balances, still looks right on the
 * cash book, and only shows up as a nonsense profit figure months later.
 */

export interface VoucherLike {
  kind: string;
  amount: number | string;
  gstAmount?: number | string | null;
  mode?: string | null;
  vendorId?: string | null;
  customerId?: string | null;
  projectId?: string | null;
  partyName?: string | null;
  /** Optional override, so an expense can be booked to a specific head. */
  accountCode?: string | null;
}

/** Cash or bank, decided by how the money actually moved. */
export function moneyAccount(mode: string | null | undefined): string {
  return mode === 'CASH' ? '1110' : '1121';
}

export type RuleResult = { ok: true; lines: DraftLine[]; narration: string } | { error: string };

/**
 * A voucher — money in or out, or material received.
 *
 * The GST split matters: input GST is *not* a cost, it is money the government
 * owes you back. Booking it to the expense head overstates project cost and
 * loses the credit, which is a real amount of money on a construction spend.
 */
export function voucherLines(v: VoucherLike): RuleResult {
  const gross = Number(v.amount);
  if (!Number.isFinite(gross) || gross <= 0) return { error: 'A voucher with no amount cannot be posted.' };

  const gst = Number(v.gstAmount ?? 0) || 0;
  const net = Math.round((gross - gst) * 100) / 100;
  if (net < 0) return { error: 'The GST on this voucher is larger than the voucher itself.' };

  const money = moneyAccount(v.mode);
  const party = { vendorId: v.vendorId ?? null, customerId: v.customerId ?? null, projectId: v.projectId ?? null };
  const who = v.partyName ?? 'party';

  switch (v.kind) {
    case 'CASH_RECEIVED':
    case 'BANK_RECEIVED': {
      // Money from a buyer is an advance until the sale is recognised. Treating
      // a receipt as income on the day it arrives is the single most common way
      // a developer's books overstate profit.
      return {
        ok: true,
        narration: `Received from ${who}`,
        lines: [
          { accountCode: money, debit: gross, ...party },
          { accountCode: '2120', credit: gross, ...party },
        ],
      };
    }

    case 'CASH_PAID':
    case 'BANK_PAID': {
      const expense = v.accountCode || '6900';
      const lines: DraftLine[] = [{ accountCode: expense, debit: net, ...party }];
      if (gst > 0) {
        // Split evenly across CGST and SGST — the within-state case, which is
        // almost everything for both projects. An inter-state bill needs IGST
        // and should carry an explicit account code.
        const half = Math.round((gst / 2) * 100) / 100;
        lines.push({ accountCode: '1151', debit: half, ...party });
        lines.push({ accountCode: '1152', debit: Math.round((gst - half) * 100) / 100, ...party });
      }
      lines.push({ accountCode: money, credit: gross, ...party });
      return { ok: true, narration: `Paid to ${who}`, lines };
    }

    case 'MATERIAL_RECEIVED': {
      // Material received but not yet paid for: a cost, and a liability.
      const head = v.accountCode || '5390';
      const lines: DraftLine[] = [{ accountCode: head, debit: net, ...party }];
      if (gst > 0) {
        const half = Math.round((gst / 2) * 100) / 100;
        lines.push({ accountCode: '1151', debit: half, ...party });
        lines.push({ accountCode: '1152', debit: Math.round((gst - half) * 100) / 100, ...party });
      }
      lines.push({ accountCode: '2110', credit: gross, ...party });
      return { ok: true, narration: `Material received from ${who}`, lines };
    }

    case 'MATERIAL_ISSUED': {
      // Out of store and into the work. Both sides are assets, so this changes
      // where the value sits without touching profit.
      return {
        ok: true,
        narration: `Material issued to site`,
        lines: [
          { accountCode: '1220', debit: gross, ...party },
          { accountCode: v.accountCode || '5390', credit: gross, ...party },
        ],
      };
    }

    default:
      return { error: `There is no posting rule for a "${v.kind}" voucher.` };
  }
}

export interface BillLike {
  amount: number | string;
  gstAmount?: number | string | null;
  vendorId?: string | null;
  projectId?: string | null;
  vendorName?: string | null;
  accountCode?: string | null;
}

/** A vendor bill: cost and input credit now, payment later. */
export function vendorBillLines(b: BillLike): RuleResult {
  const gross = Number(b.amount);
  if (!Number.isFinite(gross) || gross <= 0) return { error: 'A bill with no amount cannot be posted.' };
  const gst = Number(b.gstAmount ?? 0) || 0;
  const net = Math.round((gross - gst) * 100) / 100;
  if (net < 0) return { error: 'The GST on this bill is larger than the bill itself.' };

  const party = { vendorId: b.vendorId ?? null, projectId: b.projectId ?? null };
  const lines: DraftLine[] = [{ accountCode: b.accountCode || '5390', debit: net, ...party }];
  if (gst > 0) {
    const half = Math.round((gst / 2) * 100) / 100;
    lines.push({ accountCode: '1151', debit: half, ...party });
    lines.push({ accountCode: '1152', debit: Math.round((gst - half) * 100) / 100, ...party });
  }
  lines.push({ accountCode: '2110', credit: gross, ...party });
  return { ok: true, narration: `Bill from ${b.vendorName ?? 'vendor'}`, lines };
}

export interface InvoiceLike {
  total: number | string;
  cgst?: number | string | null;
  sgst?: number | string | null;
  igst?: number | string | null;
  customerId?: string | null;
  projectId?: string | null;
  clientName?: string | null;
}

/** An invoice raised on a buyer: receivable now, cash later. */
export function invoiceLines(i: InvoiceLike): RuleResult {
  const total = Number(i.total);
  if (!Number.isFinite(total) || total <= 0) return { error: 'An invoice with no amount cannot be posted.' };

  const cgst = Number(i.cgst ?? 0) || 0;
  const sgst = Number(i.sgst ?? 0) || 0;
  const igst = Number(i.igst ?? 0) || 0;
  const tax = Math.round((cgst + sgst + igst) * 100) / 100;
  const net = Math.round((total - tax) * 100) / 100;
  if (net < 0) return { error: 'The tax on this invoice is larger than the invoice itself.' };

  const party = { customerId: i.customerId ?? null, projectId: i.projectId ?? null };
  const lines: DraftLine[] = [
    { accountCode: '1130', debit: total, ...party },
    { accountCode: '4100', credit: net, ...party },
  ];
  if (cgst > 0) lines.push({ accountCode: '2141', credit: cgst, ...party });
  if (sgst > 0) lines.push({ accountCode: '2142', credit: sgst, ...party });
  if (igst > 0) lines.push({ accountCode: '2143', credit: igst, ...party });
  return { ok: true, narration: `Invoice to ${i.clientName ?? 'buyer'}`, lines };
}

export interface SettlementLike extends VoucherLike {
  tdsAmount?: number | string | null;
  retentionAmount?: number | string | null;
  /** BOCW labour cess withheld — owed to the welfare board, not saved. */
  cessAmount?: number | string | null;
  /** Ad-hoc recovery, usually a mobilisation advance being set off. */
  deductionAmount?: number | string | null;
}

/**
 * A contractor payment with money held back.
 *
 * The cheque is for the net, but the cost is the gross and the two deductions
 * are liabilities that outlive the payment: TDS you must deposit under s.194C
 * within the month, and retention you owe the contractor when the
 * defect-liability period expires. Booking only the net understates project
 * cost by the retention and leaves the 26Q deposit with no ledger balance to
 * clear against — which is exactly the reconciliation that eats a week at
 * year end.
 */
export function contractorSettlementLines(v: SettlementLike): RuleResult {
  const net = Number(v.amount);
  if (!Number.isFinite(net) || net <= 0) return { error: 'A payment with no amount cannot be posted.' };

  const tds = Math.max(0, Number(v.tdsAmount ?? 0) || 0);
  const retention = Math.max(0, Number(v.retentionAmount ?? 0) || 0);
  const cess = Math.max(0, Number(v.cessAmount ?? 0) || 0);
  const deduction = Math.max(0, Number(v.deductionAmount ?? 0) || 0);
  if (tds === 0 && retention === 0 && cess === 0 && deduction === 0) return voucherLines({ ...v, kind: v.kind });

  // The certified value of the work, which is the cost — not the cheque.
  const gross = Math.round((net + tds + retention + cess + deduction) * 100) / 100;
  const money = moneyAccount(v.mode);
  const party = { vendorId: v.vendorId ?? null, customerId: v.customerId ?? null, projectId: v.projectId ?? null };
  const head = v.accountCode || '5410';

  const lines: DraftLine[] = [{ accountCode: head, debit: gross, ...party }];
  if (tds > 0) lines.push({ accountCode: '2150', credit: tds, ...party });          // TDS payable
  if (retention > 0) lines.push({ accountCode: '2130', credit: retention, ...party }); // Retention payable
  if (cess > 0) lines.push({ accountCode: '2155', credit: cess, ...party });             // BOCW cess payable
  // A recovery is not a discount: it clears the advance you already paid this
  // contractor. Dropping it understated project cost AND left the advance
  // sitting on the balance sheet as an asset for ever.
  if (deduction > 0) lines.push({ accountCode: '1140', credit: deduction, ...party });    // Advances to vendors
  lines.push({ accountCode: money, credit: net, ...party });

  return {
    ok: true,
    narration: `Paid to ${v.partyName ?? 'contractor'}${tds ? ` (TDS ${tds.toLocaleString('en-IN')} withheld)` : ''}${retention ? ` (retention ${retention.toLocaleString('en-IN')} held)` : ''}${cess ? ` (cess ${cess.toLocaleString('en-IN')} withheld)` : ''}`,
    lines,
  };
}

/**
 * A payment that settles a vendor bill already in the books.
 *
 * The bill has already booked the cost and the creditor. Debiting the expense
 * again at payment would count the same spend twice and leave the creditor
 * balance standing for ever — which is precisely what happened when bills
 * started posting and payments still posted as though they had not.
 */
export function billSettlementLines(v: {
  amount: number | string; mode?: string | null; vendorId?: string | null; projectId?: string | null;
  partyName?: string | null; billNumber?: string | null;
  tdsAmount?: number | string | null; retentionAmount?: number | string | null;
}): RuleResult {
  const gross = Number(v.amount);
  if (!Number.isFinite(gross) || gross <= 0) return { error: 'A payment with no amount cannot be posted.' };

  const tds = Math.max(0, Number(v.tdsAmount ?? 0) || 0);
  const retention = Math.max(0, Number(v.retentionAmount ?? 0) || 0);
  const net = Math.round((gross - tds - retention) * 100) / 100;
  if (net < 0) return { error: 'The deductions on this payment are larger than the bill.' };

  const party = { vendorId: v.vendorId ?? null, customerId: null, projectId: v.projectId ?? null };
  // The bill already booked the cost; this clears the payable in full. Anything
  // withheld from the cheque is a liability that moves from one head to another,
  // never a reduction in what was owed.
  const lines: DraftLine[] = [{ accountCode: '2110', debit: gross, ...party }];
  if (tds > 0) lines.push({ accountCode: '2150', credit: tds, ...party });
  if (retention > 0) lines.push({ accountCode: '2130', credit: retention, ...party });
  if (net > 0) lines.push({ accountCode: moneyAccount(v.mode), credit: net, ...party });

  return {
    ok: true,
    narration: `Settled bill ${v.billNumber ?? ''} — ${v.partyName ?? 'vendor'}`.replace(/\s+/g, ' ').trim(),
    lines,
  };
}
