import 'server-only';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { drawLetterhead } from '@/lib/pdf/letterhead';

// Brand colours (RGB 0..1)
const BRASS = rgb(0.627, 0.49, 0.204);
const CHARCOAL = rgb(0.063, 0.059, 0.051);
const SAND = rgb(0.945, 0.929, 0.898);
const MUTE = rgb(0.45, 0.42, 0.38);
const LINE = rgb(0.85, 0.83, 0.79);

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const money = (n: number) => `Rs. ${inr.format(n)}`; // ASCII only (StandardFonts lacks the rupee glyph)
const ascii = (s: string) => (s || '').replace(/[^\x20-\x7E]/g, ' ');

export interface InvoiceItemPdf { description: string; hsnSac: string | null; quantity: number; rate: number; gstRate: number; amount: number }
export interface InvoicePdfData {
  number: string; clientName: string; clientGstin: string | null; status: string;
  issueDate: Date; dueDate: Date | null;
  subTotal: number; cgst: number; sgst: number; igst: number; total: number; notes: string | null;
  company: {
    name: string; tagline: string; website: string; reraNote: string;
    gstin?: string; pan?: string; registeredAddress?: string; siteName?: string; siteAddress?: string;
    bankName?: string; bankAccountName?: string; bankAccountNumber?: string; bankIfsc?: string;
    bankBranch?: string; upiId?: string; phone?: string; email?: string;
  };
  project: string | null; items: InvoiceItemPdf[];
}

/** Build a branded A4 tax‑invoice PDF and return the bytes. Pure pdf-lib (serverless‑safe). */
export async function buildInvoicePdf(d: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 pt
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28;
  const M = 48;
  let y = 800;

  const text = (s: string, x: number, yy: number, size = 10, f = font, color = CHARCOAL) =>
    page.drawText(ascii(s), { x, y: yy, size, font: f, color });
  const right = (s: string, xr: number, yy: number, size = 10, f = font, color = CHARCOAL) => {
    const w = f.widthOfTextAtSize(ascii(s), size);
    page.drawText(ascii(s), { x: xr - w, y: yy, size, font: f, color });
  };

  // Header — the shared letterhead, drawn from the company record.
  const { headerBottom } = drawLetterhead(page, { font, bold }, {
    legalName: d.company.name,
    registeredAddress: d.company.registeredAddress,
    phone: d.company.phone,
    email: d.company.email,
    website: d.company.website,
    gstin: d.company.gstin,
  }, { compact: true });

  y = headerBottom - 24;
  text('TAX INVOICE', M, y, 15, bold, BRASS);
  right(`# ${d.number}`, W - M, y, 12, bold);
  right(`Date: ${d.issueDate.toLocaleDateString('en-IN')}`, W - M, y - 14, 8.5, font, MUTE);
  if (d.dueDate) right(`Due: ${d.dueDate.toLocaleDateString('en-IN')}`, W - M, y - 25, 8.5, font, MUTE);

  y -= 34;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: LINE });
  y -= 24;

  // Bill to
  text('BILL TO', M, y, 8, bold, MUTE);
  text(d.clientName, M, y - 14, 12, bold);
  if (d.clientGstin) text(`GSTIN: ${d.clientGstin}`, M, y - 28, 9, font, MUTE);
  if (d.project) right(`Project: ${d.project}`, W - M, y - 14, 9, font, MUTE);
  y -= 52;

  // Items header
  const cols = { desc: M, qty: 320, rate: 380, gst: 450, amt: W - M };
  page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 22, color: rgb(0.96, 0.95, 0.93) });
  text('DESCRIPTION', cols.desc + 4, y, 8, bold, MUTE);
  right('QTY', cols.qty + 30, y, 8, bold, MUTE);
  right('RATE', cols.rate + 40, y, 8, bold, MUTE);
  right('GST%', cols.gst + 20, y, 8, bold, MUTE);
  right('AMOUNT', cols.amt, y, 8, bold, MUTE);
  y -= 26;

  for (const it of d.items) {
    text(it.description, cols.desc + 4, y, 10);
    if (it.hsnSac) text(`HSN/SAC: ${it.hsnSac}`, cols.desc + 4, y - 11, 7, font, MUTE);
    right(inr.format(it.quantity), cols.qty + 30, y, 10);
    right(money(it.rate), cols.rate + 40, y, 10);
    right(`${it.gstRate}%`, cols.gst + 20, y, 10);
    right(money(it.amount), cols.amt, y, 10);
    y -= it.hsnSac ? 26 : 20;
    page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.5, color: LINE });
  }

  // Totals
  y -= 10;
  const tx = W - M;
  const totalRow = (label: string, val: number, f = font, size = 10) => { text(label, 360, y, size, f, MUTE); right(money(val), tx, y, size, f); y -= 16; };
  totalRow('Subtotal', d.subTotal);
  if (d.cgst) totalRow('CGST', d.cgst);
  if (d.sgst) totalRow('SGST', d.sgst);
  if (d.igst) totalRow('IGST', d.igst);
  page.drawLine({ start: { x: 360, y: y + 6 }, end: { x: tx, y: y + 6 }, thickness: 1, color: LINE });
  y -= 4;
  text('TOTAL', 360, y, 12, bold, CHARCOAL); right(money(d.total), tx, y, 13, bold, BRASS);
  y -= 40;

  if (d.notes) { text('Notes', M, y, 8, bold, MUTE); text(d.notes, M, y - 13, 9, font, CHARCOAL); y -= 34; }

  // Bank details — so the payer never has to ask for them
  const bank = [
    d.company.bankAccountName ? `A/c name: ${d.company.bankAccountName}` : '',
    d.company.bankName ? `Bank: ${d.company.bankName}` : '',
    d.company.bankAccountNumber ? `A/c no: ${d.company.bankAccountNumber}` : '',
    d.company.bankIfsc ? `IFSC: ${d.company.bankIfsc}` : '',
    d.company.bankBranch ? `Branch: ${d.company.bankBranch}` : '',
    d.company.upiId ? `UPI: ${d.company.upiId}` : '',
  ].filter(Boolean);
  if (bank.length) {
    const boxY = Math.max(96, y - 8);
    page.drawRectangle({ x: M - 6, y: boxY - 12 - bank.length * 11, width: 290, height: bank.length * 11 + 26, color: SAND });
    text('PAYMENT DETAILS', M, boxY, 8, bold, MUTE);
    bank.forEach((line, i) => text(line, M, boxY - 13 - i * 11, 8, font, CHARCOAL));
  }

  // Footer — contact details come from the letterhead; these two lines are
  // specific to an invoice.
  if (d.company.siteAddress) text(`Site: ${d.company.siteName ? d.company.siteName + ' - ' : ''}${d.company.siteAddress}`.slice(0, 110), M, 108, 7, font, MUTE);
  text(`${d.company.reraNote}   ·   Status: ${d.status}`, M, 98, 7, font, MUTE);

  return doc.save();
}
