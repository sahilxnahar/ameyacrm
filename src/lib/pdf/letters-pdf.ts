import 'server-only';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { DemandTax } from '@/lib/sales/tax';

const NAVY = rgb(0.106, 0.165, 0.290);   // #1B2A4A
const BRASS = rgb(0.627, 0.49, 0.204);   // #A07D34 (gold)
const CHARCOAL = rgb(0.063, 0.059, 0.051);
const MUTE = rgb(0.45, 0.42, 0.38);
const LINE = rgb(0.85, 0.83, 0.79);
const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const money = (n: number) => `Rs. ${inr.format(Math.round(n * 100) / 100)}`;
const ascii = (s: string) => (s || '').replace(/[^\x20-\x7E]/g, ' ');

export interface LetterLine { label: string; amount: number; due?: string | null; status?: string | null }
export interface LetterData {
  kind: 'DEMAND' | 'ALLOTMENT';
  company: { name: string; tagline: string; reraNote: string };
  date: Date; buyerName: string; reference: string;
  unit: string; project: string; typology?: string | null; area?: number | null;
  agreementValue?: number | null; lines: LetterLine[]; amountDue?: number; payByDays?: number;
  /** GST + TDS (194-IA) breakup, shown under the demand total. */
  tax?: DemandTax | null;
}

export async function buildLetterPdf(d: LetterData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, M = 54;
  let y = 793;
  const text = (s: string, x: number, yy: number, size = 10, f = font, c = CHARCOAL) => page.drawText(ascii(s), { x, y: yy, size, font: f, color: c });
  const right = (s: string, xr: number, yy: number, size = 10, f = font, c = CHARCOAL) => page.drawText(ascii(s), { x: xr - f.widthOfTextAtSize(ascii(s), size), y: yy, size, font: f, color: c });
  const wrap = (s: string, size: number, maxW: number) => { const out: string[] = []; let ln = ''; for (const w of s.split(' ')) { const t = ln ? ln + ' ' + w : w; if (font.widthOfTextAtSize(ascii(t), size) > maxW) { out.push(ln); ln = w; } else ln = t; } if (ln) out.push(ln); return out; };

  text(d.company.name, M, y, 20, bold, NAVY);
  y -= 15; text(d.company.tagline, M, y, 9, font, MUTE);
  if (d.company.reraNote) { y -= 11; text(d.company.reraNote, M, y, 8, font, MUTE); }
  y -= 10; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1.2, color: BRASS });
  y -= 26;

  right(d.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }), W - M, y, 10, font, MUTE);
  const title = d.kind === 'DEMAND' ? 'PAYMENT DEMAND NOTICE' : 'LETTER OF ALLOTMENT';
  text(title, M, y, 14, bold, NAVY); y -= 28;

  text('To,', M, y, 10); y -= 14; text(d.buyerName, M, y, 11, bold); y -= 22;
  text(`Ref: ${d.reference}  |  Unit ${d.unit}, ${d.project}${d.typology ? ` (${d.typology})` : ''}`, M, y, 9.5, font, MUTE); y -= 22;

  const intro = d.kind === 'DEMAND'
    ? `Dear ${d.buyerName}, as per your booking and the construction-linked payment plan for the above unit, the following amount(s) are now due and payable. We request you to clear the outstanding within ${d.payByDays ?? 15} days of this notice to avoid interest and to keep your allotment in good standing.`
    : `Dear ${d.buyerName}, we are pleased to confirm the allotment of the above unit to you. Your booking is registered under reference ${d.reference}. The agreed consideration and construction-linked payment schedule are set out below. Kindly honour each milestone as it falls due.`;
  for (const ln of wrap(intro, 10, W - 2 * M)) { text(ln, M, y, 10); y -= 14; }
  y -= 10;

  // table
  page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 20, color: rgb(0.97, 0.96, 0.93) });
  text(d.kind === 'DEMAND' ? 'PARTICULARS' : 'PAYMENT MILESTONE', M + 8, y + 1, 8.5, bold, BRASS);
  right('AMOUNT', W - M - 8, y + 1, 8.5, bold, BRASS); y -= 24;
  for (const it of d.lines) {
    text(`${it.label}${it.due ? `  (due ${it.due})` : ''}${it.status ? `  [${it.status}]` : ''}`, M + 8, y, 10);
    right(money(it.amount), W - M - 8, y, 10); y -= 16;
  }
  page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.6, color: LINE });
  if (d.kind === 'DEMAND' && d.amountDue != null) {
    y -= 14; page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 22, color: NAVY });
    text('DEMAND VALUE', M + 8, y + 2, 11, bold, rgb(1, 1, 1)); right(money(d.amountDue), W - M - 8, y + 2, 12, bold, BRASS); y -= 30;

    // GST + TDS (194-IA) breakup — computed from the demand value and the
    // agreement value, so the buyer sees exactly what to pay and what to deduct.
    if (d.tax) {
      const t = d.tax;
      const row = (label: string, val: string, boldRow = false, color = CHARCOAL) => {
        text(label, M + 8, y, 9.5, boldRow ? bold : font, color); right(val, W - M - 8, y, 9.5, boldRow ? bold : font, color); y -= 15;
      };
      row('Demand value (base)', money(t.base));
      row(`Add: GST @ ${t.gstPct}%`, money(t.gst));
      page.drawLine({ start: { x: M + 8, y: y + 8 }, end: { x: W - M - 8, y: y + 8 }, thickness: 0.4, color: LINE });
      row('Gross payable', money(t.gross), true);
      if (t.tdsApplicable) row(`Less: TDS @ ${t.tdsPct}% (Sec. 194-IA, to be deposited by buyer)`, `- ${money(t.tds)}`, false, MUTE);
      page.drawLine({ start: { x: M + 8, y: y + 8 }, end: { x: W - M - 8, y: y + 8 }, thickness: 0.4, color: LINE });
      row('NET PAYABLE TO DEVELOPER', money(t.netToDeveloper), true, NAVY);
      y -= 6;
      for (const note of [t.gstNote, t.tdsNote]) {
        for (const ln of wrap(note, 8, W - 2 * M - 16)) { text(ln, M + 8, y, 8, font, MUTE); y -= 11; }
      }
      y -= 8;
    }
  } else if (d.agreementValue != null) {
    y -= 2; text('Agreement value', M + 8, y, 10, bold); right(money(d.agreementValue), W - M - 8, y, 11, bold); y -= 24;
  }

  y -= 12; text('For ' + d.company.name, M, y, 10); y -= 34; text('Authorised Signatory', M, y, 10, font, MUTE);
  y -= 30;
  const foot = 'This is a computer-generated letter. For any clarification please contact our accounts / CRM desk. Payments once made are subject to the terms of the booking application and agreement to sell.';
  for (const ln of wrap(foot, 7.5, W - 2 * M)) { text(ln, M, y, 7.5, font, MUTE); y -= 10; }
  return doc.save();
}
