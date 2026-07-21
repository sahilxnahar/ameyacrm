import 'server-only';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { rupeesInWords } from '@/lib/money-words';

const BRASS = rgb(0.627, 0.49, 0.204);
const CHARCOAL = rgb(0.063, 0.059, 0.051);
const SAND = rgb(0.945, 0.929, 0.898);
const MUTE = rgb(0.45, 0.42, 0.38);
const LINE = rgb(0.85, 0.83, 0.79);
const RUBY = rgb(0.608, 0.067, 0.118);

const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// StandardFonts are Latin-1 only, so translate the punctuation people actually
// paste in rather than blanking it out.
const ascii = (s: string) =>
  (s || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u20B9/g, 'Rs.')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E]/g, ' ');
const day = (d: Date | null) => (d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

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
  const W = 595.28, M = 48;

  const text = (s: string, x: number, y: number, size = 10, f = font, color = CHARCOAL) =>
    page.drawText(ascii(s), { x, y, size, font: f, color });
  const right = (s: string, xr: number, y: number, size = 10, f = font, color = CHARCOAL) =>
    page.drawText(ascii(s), { x: xr - f.widthOfTextAtSize(ascii(s), size), y, size, font: f, color });

  page.drawRectangle({ x: 0, y: 828, width: W, height: 14, color: BRASS });

  let y = 796;
  text(d.company.name, M, y, 21, bold, CHARCOAL);
  text(d.company.tagline, M, y - 15, 9, font, MUTE);
  if (d.company.registeredAddress) {
    text(d.company.registeredAddress.slice(0, 62), M, y - 28, 8, font, MUTE);
    if (d.company.registeredAddress.length > 62) text(d.company.registeredAddress.slice(62, 124), M, y - 38, 8, font, MUTE);
  }
  if (d.company.gstin) text(`GSTIN: ${d.company.gstin}`, M, y - 51, 8.5, bold);

  const title = d.direction === 'paid' ? 'PAYMENT VOUCHER' : 'RECEIPT';
  right(title, W - M, y, 17, bold, BRASS);
  right(`# ${d.number}`, W - M, y - 20, 11, bold);
  right(`Voucher date: ${day(d.voucherDate)}`, W - M, y - 35, 9, font, MUTE);
  right(d.kindLabel, W - M, y - 48, 9, font, MUTE);

  y -= 78;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: LINE });

  if (d.status === 'CANCELLED') {
    y -= 24;
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 24, color: rgb(0.98, 0.92, 0.93) });
    text(`CANCELLED${d.cancelReason ? ` — ${d.cancelReason}` : ''}`, M + 10, y + 2, 10, bold, RUBY);
    y -= 14;
  }

  // Party
  y -= 34;
  text(d.direction === 'paid' ? 'PAID TO' : 'RECEIVED FROM', M, y, 8, bold, MUTE);
  text(d.partyName, M, y - 18, 15, bold);
  if (d.partyPhone) text(d.partyPhone, M, y - 33, 9, font, MUTE);
  if (d.project) right(`Project: ${d.project}`, W - M, y - 18, 9, font, MUTE);

  // Amount block
  y -= 66;
  page.drawRectangle({ x: M, y: y - 46, width: W - 2 * M, height: 62, color: SAND });
  text('AMOUNT', M + 14, y + 2, 8, bold, MUTE);
  text(`Rs. ${inr.format(d.amount)}`, M + 14, y - 24, 24, bold, CHARCOAL);
  // Amount in words has to stay on one line inside the box, so shrink to fit
  // rather than wrapping on top of itself.
  const words = rupeesInWords(d.amount);
  const avail = W - 2 * M - 28;
  let wordSize = 8.5;
  while (wordSize > 5.5 && font.widthOfTextAtSize(ascii(words), wordSize) > avail) wordSize -= 0.25;
  text(words, M + 14, y - 40, wordSize, font, MUTE);
  right(d.mode, W - M - 14, y + 2, 11, bold, BRASS);

  // Bank trail — the point of the whole document
  y -= 82;
  text('BANK TRAIL', M, y, 8, bold, MUTE);
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
    text(v, M + 190, y, isUtr ? 11 : 9.5, isUtr ? bold : font, isUtr && !d.utr ? MUTE : CHARCOAL);
    y -= 19;
  }

  if (d.narration) {
    y -= 12;
    text('PARTICULARS', M, y, 8, bold, MUTE);
    y -= 16;
    const words2 = d.narration.split(/\s+/);
    let line = '';
    for (const w of words2) {
      if (font.widthOfTextAtSize(ascii(`${line} ${w}`), 9.5) > W - 2 * M) { text(line, M, y, 9.5); y -= 14; line = w; }
      else line = line ? `${line} ${w}` : w;
    }
    if (line) { text(line, M, y, 9.5); y -= 14; }
  }

  // Signatures
  const sigY = 150;
  page.drawLine({ start: { x: M, y: sigY }, end: { x: M + 160, y: sigY }, thickness: 0.5, color: LINE });
  text('Prepared by', M, sigY - 13, 8, font, MUTE);
  if (d.preparedBy) text(d.preparedBy, M, sigY + 6, 9);
  page.drawLine({ start: { x: W - M - 160, y: sigY }, end: { x: W - M, y: sigY }, thickness: 0.5, color: LINE });
  right(d.direction === 'paid' ? 'Receiver / Authorised signatory' : 'For ' + d.company.name, W - M, sigY - 13, 8, font, MUTE);

  // Footer
  page.drawLine({ start: { x: M, y: 92 }, end: { x: W - M, y: 92 }, thickness: 0.5, color: LINE });
  const contact = [d.company.phone, d.company.email, d.company.website.replace(/^https?:\/\//, '')].filter(Boolean).join('  ·  ');
  text(contact, M, 78, 8, font, MUTE);
  text('Computer-generated voucher from the Ameya Heights CRM. Retain with the bank statement for reconciliation.', M, 66, 7.5, font, MUTE);
  page.drawRectangle({ x: 0, y: 0, width: W, height: 10, color: BRASS });

  return doc.save();
}
