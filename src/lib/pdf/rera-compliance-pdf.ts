import 'server-only';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { drawLetterhead } from '@/lib/pdf/letterhead';
import { EMBLEM_PNG_BASE64 } from '@/lib/pdf/brand-marks';
import type { EscrowPosition } from '@/lib/capital/escrow';

const NAVY = rgb(0.106, 0.165, 0.290);
const GOLD = rgb(0.627, 0.49, 0.204);
const CHARCOAL = rgb(0.063, 0.059, 0.051);
const MUTE = rgb(0.45, 0.42, 0.38);
const LINE = rgb(0.85, 0.83, 0.79);
const GREEN = rgb(0.18, 0.49, 0.20);
const RUBY = rgb(0.608, 0.067, 0.118);
const AMBER = rgb(0.60, 0.44, 0.10);

const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n: number) => `Rs. ${inr.format(Math.round(n * 100) / 100)}`;
const ascii = (s: string) => (s || '').replace(/[^\x20-\x7E]/g, ' ');
const day = (d: Date) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

export interface ReraComplianceData {
  company: { name: string; registeredAddress?: string; phone?: string; email?: string; website?: string; gstin?: string };
  projectName: string;
  reraNumber: string | null;
  asOf: Date;
  escrow: EscrowPosition;
  certifiedPct: number;
}

/** A formal RERA 70:30 escrow compliance statement, in the house navy + gold. */
export async function buildReraCompliancePdf(d: ReraComplianceData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const emblem = await doc.embedPng(Buffer.from(EMBLEM_PNG_BASE64, 'base64'));
  const W = 595.28, M = 48;

  const text = (s: string, x: number, yy: number, size = 10, f = font, c = CHARCOAL) => page.drawText(ascii(s), { x, y: yy, size, font: f, color: c });
  const right = (s: string, xr: number, yy: number, size = 10, f = font, c = CHARCOAL) => page.drawText(ascii(s), { x: xr - f.widthOfTextAtSize(ascii(s), size), y: yy, size, font: f, color: c });

  const { headerBottom } = drawLetterhead(page, { font, bold }, {
    legalName: d.company.name, registeredAddress: d.company.registeredAddress,
    phone: d.company.phone, email: d.company.email, website: d.company.website, gstin: d.company.gstin,
  }, { emblem });

  let y = headerBottom - 26;
  text('RERA ESCROW COMPLIANCE STATEMENT', M, y, 14, bold, NAVY);
  text('The 70:30 designated-account rule (Sec. 4(2)(l)(D), RERA 2016)', M, y - 13, 8.5, font, MUTE);
  right(`As of ${day(d.asOf)}`, W - M, y, 9, font, MUTE);
  y -= 34;

  text('PROJECT', M, y, 8, bold, GOLD);
  text(d.projectName, M, y - 15, 14, bold, NAVY);
  right(d.reraNumber ? `RERA Reg. ${d.reraNumber}` : 'RERA registration in progress', W - M, y - 15, 9, font, MUTE);
  y -= 42;

  const e = d.escrow;
  const rows: Array<[string, string, boolean]> = [
    ['Total amount received from allottees', money(e.totalReceipts), false],
    [`Amount required in the designated account (${e.escrowPct}%)`, money(e.requiredDeposit), true],
    ['Amount actually deposited to the designated account', money(e.deposited), false],
    ['Amount withdrawn from the designated account', money(e.withdrawn), false],
    ['Current designated-account balance', money(e.balance), false],
    [`Certified construction progress`, `${d.certifiedPct}%`, false],
    ['Withdrawable now (certified entitlement, less drawn)', money(e.withdrawable), true],
  ];

  page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 20, color: rgb(0.93, 0.945, 0.97) });
  text('PARTICULARS', M + 8, y + 1, 8.5, bold, NAVY);
  right('AMOUNT', W - M - 8, y + 1, 8.5, bold, NAVY);
  y -= 24;
  for (const [label, val, strong] of rows) {
    text(label, M + 8, y, 9.5, strong ? bold : font, strong ? NAVY : CHARCOAL);
    right(val, W - M - 8, y, 10, strong ? bold : font, strong ? NAVY : CHARCOAL);
    page.drawLine({ start: { x: M, y: y - 6 }, end: { x: W - M, y: y - 6 }, thickness: 0.4, color: LINE });
    y -= 20;
  }
  y -= 10;

  // Compliance verdict
  const breach = e.overWithdrawn;
  const shortfall = e.depositShortfall > 0;
  const status = breach ? 'BREACH — WITHDRAWALS EXCEED CERTIFIED ENTITLEMENT' : shortfall ? 'ACTION NEEDED — DESIGNATED ACCOUNT UNDER-FUNDED' : 'COMPLIANT';
  const statusColor = breach ? RUBY : shortfall ? AMBER : GREEN;
  const bg = breach ? rgb(0.98, 0.92, 0.93) : shortfall ? rgb(0.99, 0.96, 0.88) : rgb(0.92, 0.96, 0.92);
  page.drawRectangle({ x: M, y: y - 24, width: W - 2 * M, height: 34, color: bg });
  text('STATUS', M + 10, y + 2, 8, bold, MUTE);
  text(status, M + 10, y - 14, 11, bold, statusColor);
  if (shortfall && !breach) right(`Deposit ${money(e.depositShortfall)} to comply`, W - M - 10, y - 14, 9, font, statusColor);
  y -= 46;

  const note = 'This statement is generated from receipts recorded in the CRM and the escrow movements logged against this project, applying the RERA 70:30 rule: seventy per cent of allottee receipts must remain in the designated account and may be withdrawn only in proportion to the architect/engineer-certified stage of completion. It is a management document to support, not replace, the certificates and CA/architect/engineer attestations required for each withdrawal.';
  const wrap = (s: string, size: number, maxW: number) => { const out: string[] = []; let ln = ''; for (const w of s.split(' ')) { const t = ln ? ln + ' ' + w : w; if (font.widthOfTextAtSize(ascii(t), size) > maxW) { out.push(ln); ln = w; } else ln = t; } if (ln) out.push(ln); return out; };
  for (const ln of wrap(note, 8, W - 2 * M)) { text(ln, M, y, 8, font, MUTE); y -= 11; }

  y -= 20;
  page.drawLine({ start: { x: M, y }, end: { x: M + 170, y }, thickness: 0.6, color: LINE });
  text('For ' + d.company.name, M, y - 13, 9, font, MUTE);
  right('Authorised Signatory', W - M, y - 13, 9, font, MUTE);

  return doc.save();
}
