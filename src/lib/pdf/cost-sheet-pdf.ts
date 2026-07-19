import 'server-only';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const BRASS = rgb(0.627, 0.49, 0.204);
const CHARCOAL = rgb(0.063, 0.059, 0.051);
const MUTE = rgb(0.45, 0.42, 0.38);
const LINE = rgb(0.85, 0.83, 0.79);
const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const money = (n: number) => `Rs. ${inr.format(Math.round(n * 100) / 100)}`;
const ascii = (s: string) => (s || '').replace(/[^\x20-\x7E]/g, ' ');

export interface CostLine { label: string; amount: number }
export interface CostSheetData {
  company: { name: string; tagline: string; reraNote: string };
  project: string; unitCode: string; typology: string | null; tower: string | null;
  floor: number | null; facing: string | null; carpetAreaSqft: number | null; clientName: string | null;
  ratePerSqft: number | null; basePrice: number; extras: CostLine[]; gstPercent: number; otherCharges: CostLine[];
  preparedBy: string; date: Date;
}

/** Branded A4 cost sheet. Pure pdf-lib (serverless-safe). */
export async function buildCostSheetPdf(d: CostSheetData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, M = 48;
  let y = 793;
  const text = (s: string, x: number, yy: number, size = 10, f = font, c = CHARCOAL) => page.drawText(ascii(s), { x, y: yy, size, font: f, color: c });
  const right = (s: string, xr: number, yy: number, size = 10, f = font, c = CHARCOAL) => page.drawText(ascii(s), { x: xr - f.widthOfTextAtSize(ascii(s), size), y: yy, size, font: f, color: c });

  // Header
  text(d.company.name, M, y, 20, bold, BRASS);
  text('COST SHEET', W - M - bold.widthOfTextAtSize('COST SHEET', 16), y + 2, 16, bold, CHARCOAL);
  y -= 16; text(d.company.tagline, M, y, 9, font, MUTE);
  if (d.company.reraNote) right(d.company.reraNote, W - M, y, 9, font, MUTE);
  y -= 12; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1.2, color: BRASS });
  y -= 24;

  // Unit info block (two columns)
  const rows: Array<[string, string]> = [
    ['Project', d.project],
    ['Unit', d.unitCode + (d.typology ? `  (${d.typology})` : '')],
    ['Tower / Floor', `${d.tower ?? '-'} / ${d.floor ?? '-'}`],
    ['Facing', d.facing ?? '-'],
    ['Carpet area', d.carpetAreaSqft ? `${inr.format(d.carpetAreaSqft)} sq.ft` : '-'],
    ['Rate', d.ratePerSqft ? `${money(d.ratePerSqft)} / sq.ft` : '-'],
  ];
  if (d.clientName) rows.unshift(['Prepared for', d.clientName]);
  for (let i = 0; i < rows.length; i++) {
    const col = i % 2, rowY = y - Math.floor(i / 2) * 18;
    const x = M + col * ((W - 2 * M) / 2);
    text(rows[i][0].toUpperCase(), x, rowY, 7.5, bold, MUTE);
    text(rows[i][1], x, rowY - 11, 10.5, font, CHARCOAL);
  }
  y -= Math.ceil(rows.length / 2) * 18 + 16;

  // Charges table
  const consideration = d.basePrice + d.extras.reduce((s, e) => s + e.amount, 0);
  const gst = consideration * (d.gstPercent / 100);
  const otherTotal = d.otherCharges.reduce((s, e) => s + e.amount, 0);
  const grand = consideration + gst + otherTotal;

  const th = (label: string) => { page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 20, color: rgb(0.97, 0.96, 0.93) }); text(label, M + 8, y + 1, 8.5, bold, BRASS); right('AMOUNT', W - M - 8, y + 1, 8.5, bold, BRASS); y -= 24; };
  const line = (label: string, amount: number, f = font, size = 10) => { text(label, M + 8, y, size, f); right(money(amount), W - M - 8, y, size, f); y -= 17; };
  const sep = () => { page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.6, color: LINE }); };

  th('PRICE BREAK-UP');
  line('Basic Sale Price', d.basePrice);
  for (const e of d.extras) line(e.label, e.amount);
  sep(); line('Consideration Value', consideration, bold);
  line(`GST @ ${d.gstPercent}%`, gst);
  sep(); line('Sub-total (incl. GST)', consideration + gst, bold);
  if (d.otherCharges.length) { for (const e of d.otherCharges) line(e.label, e.amount); }
  y -= 4; page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 22, color: CHARCOAL });
  text('GRAND TOTAL', M + 8, y + 2, 11, bold, rgb(1, 1, 1)); right(money(grand), W - M - 8, y + 2, 12, bold, BRASS);
  y -= 40;

  // Footer
  text(`Prepared by ${d.preparedBy}  |  ${d.date.toLocaleDateString('en-IN')}`, M, y, 9, font, MUTE);
  y -= 24;
  const disc = 'This cost sheet is an estimate for discussion only and does not constitute an offer or agreement. Prices, taxes and charges are indicative and subject to change without notice. Applicable taxes, stamp duty and registration charges are payable as per prevailing rates.';
  const words = disc.split(' '); let ln = ''; const maxW = W - 2 * M;
  for (const w of words) { const t = ln ? ln + ' ' + w : w; if (font.widthOfTextAtSize(t, 7.5) > maxW) { text(ln, M, y, 7.5, font, MUTE); y -= 10; ln = w; } else ln = t; }
  if (ln) text(ln, M, y, 7.5, font, MUTE);
  return doc.save();
}
