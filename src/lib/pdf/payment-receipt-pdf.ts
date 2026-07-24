import 'server-only';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { rupeesInWords } from '@/lib/money-words';
import { drawLetterhead } from '@/lib/pdf/letterhead';
import { EMBLEM_PNG_BASE64 } from '@/lib/pdf/brand-marks';

// Navy + gold house palette.
const NAVY = rgb(0.106, 0.165, 0.290);   // #1B2A4A
const GOLD = rgb(0.627, 0.49, 0.204);    // #A07D34
const CHARCOAL = rgb(0.063, 0.059, 0.051);
const SAND = rgb(0.945, 0.929, 0.898);
const NAVY_TINT = rgb(0.93, 0.945, 0.97); // very light navy wash for panels
const MUTE = rgb(0.45, 0.42, 0.38);
const LINE = rgb(0.85, 0.83, 0.79);
const RUBY = rgb(0.608, 0.067, 0.118);

const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// StandardFonts are Latin-1 only, so translate the punctuation people actually
// paste in rather than blanking it out.
const ascii = (s: string) =>
  (s || '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/·/g, '-')
    .replace(/₹/g, 'Rs.')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E]/g, ' ');
const day = (d: Date | null) => (d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
/** Turn a raw payment-mode enum (BANK_TRANSFER) into a readable label (Bank Transfer). */
const prettyMode = (m: string) =>
  (m || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bUpi\b/i, 'UPI').replace(/\bNeft\b/i, 'NEFT').replace(/\bRtgs\b/i, 'RTGS').replace(/\bImps\b/i, 'IMPS');

export interface PaymentReceiptData {
  number: string; kindLabel: string; direction: 'paid' | 'received';
  status: string; voucherDate: Date; paidOn: Date | null;
  partyName: string; partyPhone: string | null;
  amount: number; mode: string; utr: string | null; bankName: string | null;
  reference: string | null; narration: string | null;
  project: string | null; preparedBy: string | null; cancelReason: string | null;
  company: {
    name: string; tagline: string; website: string;
    gstin?: string; pan?: string; registeredAddress?: string;
    bankName?: string; bankAccountNumber?: string; bankIfsc?: string; phone?: string; email?: string;
  };
}

/** Branded A4 payment voucher / receipt. Pure pdf-lib so it runs on serverless. */
export async function buildPaymentReceiptPdf(d: PaymentReceiptData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const emblem = await doc.embedPng(Buffer.from(EMBLEM_PNG_BASE64, 'base64'));
  const W = 595.28, M = 48;

  const text = (s: string, x: number, y: number, size = 10, f = font, color = CHARCOAL) =>
    page.drawText(ascii(s), { x, y, size, font: f, color });
  const right = (s: string, xr: number, y: number, size = 10, f = font, color = CHARCOAL) =>
    page.drawText(ascii(s), { x: xr - f.widthOfTextAtSize(ascii(s), size), y, size, font: f, color });

  const { headerBottom } = drawLetterhead(page, { font, bold }, {
    legalName: d.company.name,
    registeredAddress: d.company.registeredAddress,
    phone: d.company.phone,
    email: d.company.email,
    website: d.company.website,
    gstin: d.company.gstin,
  }, { emblem });

  const title = d.direction === 'paid' ? 'PAYMENT VOUCHER' : 'RECEIPT';
  let y = headerBottom - 26;
  text(title, M, y, 15, bold, NAVY);
  text(d.kindLabel, M, y - 14, 8.5, font, MUTE);
  right(`# ${d.number}`, W - M, y, 12, bold, NAVY);
  right(day(d.voucherDate), W - M, y - 14, 9, font, MUTE);
  y -= 30;

  if (d.status === 'CANCELLED') {
    y -= 24;
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 24, color: rgb(0.98, 0.92, 0.93) });
    text(`CANCELLED${d.cancelReason ? ` — ${d.cancelReason}` : ''}`, M + 10, y + 2, 10, bold, RUBY);
    y -= 14;
  }

  // Party
  y -= 34;
  text(d.direction === 'paid' ? 'PAID TO' : 'RECEIVED FROM', M, y, 8, bold, GOLD);
  text(d.partyName, M, y - 18, 15, bold, NAVY);
  if (d.partyPhone) text(d.partyPhone, M, y - 33, 9, font, MUTE);
  if (d.project) right(`Project: ${d.project}`, W - M, y - 18, 9, font, MUTE);

  // Amount block — navy accent bar on the left, sand panel.
  y -= 66;
  page.drawRectangle({ x: M, y: y - 46, width: W - 2 * M, height: 62, color: SAND });
  page.drawRectangle({ x: M, y: y - 46, width: 4, height: 62, color: NAVY });
  text('AMOUNT', M + 16, y + 2, 8, bold, MUTE);
  text(`Rs. ${inr.format(d.amount)}`, M + 16, y - 24, 24, bold, NAVY);
  // Amount in words has to stay on one line inside the box, so shrink to fit
  // rather than wrapping on top of itself.
  const words = rupeesInWords(d.amount);
  const avail = W - 2 * M - 30;
  let wordSize = 8.5;
  while (wordSize > 5.5 && font.widthOfTextAtSize(ascii(words), wordSize) > avail) wordSize -= 0.25;
  text(words, M + 16, y - 40, wordSize, font, MUTE);
  right(prettyMode(d.mode), W - M - 14, y + 2, 11, bold, GOLD);

  // Description / particulars — surfaced right under the amount, in its own
  // panel, because "what was this payment for" is the first thing anyone checks.
  y -= 78;
  if (d.narration) {
    const lines: string[] = [];
    let line = '';
    for (const w of d.narration.split(/\s+/)) {
      if (font.widthOfTextAtSize(ascii(`${line} ${w}`), 10) > W - 2 * M - 24) { if (line) lines.push(line); line = w; }
      else line = line ? `${line} ${w}` : w;
    }
    if (line) lines.push(line);
    const panelH = 22 + lines.length * 14;
    page.drawRectangle({ x: M, y: y - panelH + 14, width: W - 2 * M, height: panelH, color: NAVY_TINT });
    text('DESCRIPTION', M + 14, y + 2, 8, bold, GOLD);
    let ly = y - 14;
    for (const l of lines) { text(l, M + 14, ly, 10, font, CHARCOAL); ly -= 14; }
    y = y - panelH - 6;
  } else {
    y -= 4;
  }

  // Bank trail — the point of the whole document
  y -= 18;
  text('BANK TRAIL', M, y, 8, bold, GOLD);
  y -= 6;
  page.drawLine({ start: { x: M, y: y - 4 }, end: { x: W - M, y: y - 4 }, thickness: 0.5, color: LINE });

  const rows: Array<[string, string]> = [
    ['UTR / transaction reference', d.utr || 'Not recorded'],
    ['Value date (money moved)', day(d.paidOn ?? d.voucherDate)],
    ['Bank', d.bankName || d.company.bankName || '-'],
    ['Other reference', d.reference || '-'],
  ];
  y -= 22;
  for (const [k, v] of rows) {
    text(k, M, y, 9, font, MUTE);
    const isUtr = k.startsWith('UTR');
    text(v, M + 190, y, isUtr ? 11 : 9.5, isUtr ? bold : font, isUtr && !d.utr ? MUTE : (isUtr ? NAVY : CHARCOAL));
    y -= 19;
  }

  // Signatures
  const sigY = 150;
  page.drawLine({ start: { x: M, y: sigY }, end: { x: M + 160, y: sigY }, thickness: 0.5, color: LINE });
  text('Prepared by', M, sigY - 13, 8, font, MUTE);
  if (d.preparedBy) text(d.preparedBy, M, sigY + 6, 9, font, NAVY);
  page.drawLine({ start: { x: W - M - 160, y: sigY }, end: { x: W - M, y: sigY }, thickness: 0.5, color: LINE });
  right(d.direction === 'paid' ? 'Receiver / Authorised signatory' : 'For ' + d.company.name, W - M, sigY - 13, 8, font, MUTE);

  // Footer is drawn by the letterhead; this is the one line specific to a voucher.
  text('Computer-generated voucher. Retain with the bank statement for reconciliation.', M, 96, 7, font, MUTE);

  return doc.save();
}
