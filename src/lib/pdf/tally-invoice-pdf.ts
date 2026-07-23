import 'server-only';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { rupeesInWords } from '@/lib/money-words';
import { drawLetterhead } from '@/lib/pdf/letterhead';
import { EMBLEM_PNG_BASE64 } from '@/lib/pdf/brand-marks';

const NAVY = rgb(0.106, 0.165, 0.290);
const GOLD = rgb(0.627, 0.49, 0.204);
const CHARCOAL = rgb(0.063, 0.059, 0.051);
const NAVY_TINT = rgb(0.93, 0.945, 0.97);
const MUTE = rgb(0.45, 0.42, 0.38);
const LINE = rgb(0.85, 0.83, 0.79);

const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ascii = (s: string) => (s || '')
  .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/·/g, '-').replace(/₹/g, 'Rs.').replace(/…/g, '...').replace(/[^\x20-\x7E]/g, ' ');
const day = (d: Date | null) => (d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

export interface TallyInvoiceItem { name: string; hsn: string | null; qty: number; unit: string | null; rate: number; amount: number; gstRate: number }
export interface TallyInvoiceData {
  company: { name: string; registeredAddress: string | null; phone: string | null; email: string | null; website: string | null; gstin: string | null };
  type: 'Sales' | 'Purchase';
  number: number; date: Date; partyName: string;
  items: TallyInvoiceItem[];
  taxable: number; cgst: number; sgst: number; total: number;
  narration: string | null;
}

/** Branded A4 tax invoice for an Ameya Tally item invoice. Pure pdf-lib (serverless-safe). */
export async function buildTallyInvoicePdf(d: TallyInvoiceData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const emblem = await doc.embedPng(Buffer.from(EMBLEM_PNG_BASE64, 'base64'));
  const W = 595.28, M = 48;

  const text = (s: string, x: number, y: number, size = 10, f = font, color = CHARCOAL) => page.drawText(ascii(s), { x, y, size, font: f, color });
  const right = (s: string, xr: number, y: number, size = 10, f = font, color = CHARCOAL) => page.drawText(ascii(s), { x: xr - f.widthOfTextAtSize(ascii(s), size), y, size, font: f, color });

  const u = (s: string | null) => s ?? undefined;
  const { headerBottom, footerTop } = drawLetterhead(page, { font, bold }, {
    legalName: d.company.name, registeredAddress: u(d.company.registeredAddress), phone: u(d.company.phone),
    email: u(d.company.email), website: u(d.company.website), gstin: u(d.company.gstin),
  }, { emblem });

  const title = d.type === 'Sales' ? 'TAX INVOICE' : 'PURCHASE INVOICE';
  let y = headerBottom - 26;
  text(title, M, y, 15, bold, NAVY);
  right(`# ${d.type.charAt(0)}-${d.number}`, W - M, y, 12, bold, NAVY);
  right(day(d.date), W - M, y - 14, 9, font, MUTE);
  y -= 30;

  // Party panel
  page.drawRectangle({ x: M, y: y - 40, width: W - 2 * M, height: 40, color: NAVY_TINT });
  text(d.type === 'Sales' ? 'BILL TO' : 'FROM (VENDOR)', M + 8, y - 13, 8, bold, GOLD);
  text(d.partyName, M + 8, y - 28, 12, bold, NAVY);
  y -= 56;

  // Items table header
  const cols = [
    { x: M + 4, w: 22, label: '#', align: 'left' as const },
    { x: M + 26, w: 176, label: 'Description', align: 'left' as const },
    { x: M + 202, w: 56, label: 'HSN/SAC', align: 'left' as const },
    { x: M + 258, w: 44, label: 'Qty', align: 'right' as const },
    { x: M + 302, w: 66, label: 'Rate', align: 'right' as const },
    { x: M + 368, w: 38, label: 'GST%', align: 'right' as const },
    { x: M + 406, w: 89, label: 'Amount', align: 'right' as const },
  ];
  const rowX = M, rowW = W - 2 * M;
  page.drawRectangle({ x: rowX, y: y - 16, width: rowW, height: 16, color: NAVY });
  for (const c of cols) {
    if (c.align === 'right') right(c.label, c.x + c.w, y - 12, 8, bold, rgb(1, 1, 1));
    else text(c.label, c.x, y - 12, 8, bold, rgb(1, 1, 1));
  }
  y -= 16;

  const drawRow = (cells: string[]) => {
    y -= 15;
    cols.forEach((c, i) => {
      const s = cells[i] ?? '';
      if (c.align === 'right') right(s, c.x + c.w, y + 4, 8.5, font);
      else text(s, c.x, y + 4, 8.5, font);
    });
    page.drawLine({ start: { x: rowX, y }, end: { x: rowX + rowW, y }, thickness: 0.4, color: LINE });
  };

  const maxRows = Math.max(0, Math.floor((y - (footerTop + 150)) / 15));
  const shown = d.items.slice(0, maxRows);
  shown.forEach((it, i) => drawRow([
    String(i + 1), it.name, it.hsn ?? '-',
    `${it.qty}${it.unit ? ' ' + it.unit : ''}`, inr.format(it.rate), String(it.gstRate), inr.format(it.amount),
  ]));
  if (d.items.length > shown.length) { y -= 15; text(`... and ${d.items.length - shown.length} more line(s)`, M + 26, y + 4, 8, font, MUTE); }

  // Totals block
  y -= 18;
  const tx = W - M - 200;
  const line = (label: string, val: string, b = false) => {
    text(label, tx, y, 9, b ? bold : font, b ? NAVY : CHARCOAL);
    right(val, W - M, y, 9, b ? bold : font, b ? NAVY : CHARCOAL);
    y -= 14;
  };
  line('Taxable value', `Rs. ${inr.format(d.taxable)}`);
  line('CGST', `Rs. ${inr.format(d.cgst)}`);
  line('SGST', `Rs. ${inr.format(d.sgst)}`);
  page.drawLine({ start: { x: tx, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.6, color: GOLD });
  line('Invoice total', `Rs. ${inr.format(d.total)}`, true);

  // Amount in words
  y -= 6;
  text('Amount in words:', M, y, 8.5, bold, GOLD);
  y -= 12;
  text(rupeesInWords(d.total), M, y, 9.5, font, NAVY);

  if (d.narration) { y -= 18; text('Note:', M, y, 8.5, bold, MUTE); text(d.narration, M + 30, y, 8.5, font, CHARCOAL); }

  y -= 26;
  text('CGST/SGST split assumes an intra-state supply. Subject to Ameya Heights standard terms. E.&O.E.', M, y, 7.5, font, MUTE);
  right('For ' + d.company.name, W - M, y - 20, 9, bold, NAVY);
  right('Authorised signatory', W - M, y - 44, 8, font, MUTE);

  return doc.save();
}
