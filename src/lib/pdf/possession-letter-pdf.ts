import 'server-only';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { drawLetterhead } from '@/lib/pdf/letterhead';
import { EMBLEM_PNG_BASE64 } from '@/lib/pdf/brand-marks';

const NAVY = rgb(0.106, 0.165, 0.290);
const GOLD = rgb(0.627, 0.49, 0.204);
const CHARCOAL = rgb(0.063, 0.059, 0.051);
const MUTE = rgb(0.45, 0.42, 0.38);
const LINE = rgb(0.85, 0.83, 0.79);
const ascii = (s: string) => (s || '').replace(/[^\x20-\x7E]/g, ' ');

export interface PossessionData {
  company: { name: string; registeredAddress?: string; phone?: string; email?: string; website?: string; gstin?: string };
  buyerName: string;
  date: Date;
  reference: string | null;
  unit: string;
  project: string;
  typology: string | null;
  area: number | null;
  reraNumber: string | null;
  /** Handover checklist snapshot to print (label + done). */
  checklist: Array<{ label: string; done: boolean }>;
}

/** A formal Letter of Possession / handover acknowledgement, navy + gold. */
export async function buildPossessionLetterPdf(d: PossessionData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const emblem = await doc.embedPng(Buffer.from(EMBLEM_PNG_BASE64, 'base64'));
  const W = 595.28, M = 48;

  const text = (s: string, x: number, yy: number, size = 10, f = font, c = CHARCOAL) => page.drawText(ascii(s), { x, y: yy, size, font: f, color: c });
  const right = (s: string, xr: number, yy: number, size = 10, f = font, c = CHARCOAL) => page.drawText(ascii(s), { x: xr - f.widthOfTextAtSize(ascii(s), size), y: yy, size, font: f, color: c });
  const wrap = (s: string, size: number, maxW: number) => { const out: string[] = []; let ln = ''; for (const w of s.split(' ')) { const t = ln ? ln + ' ' + w : w; if (font.widthOfTextAtSize(ascii(t), size) > maxW) { out.push(ln); ln = w; } else ln = t; } if (ln) out.push(ln); return out; };

  const { headerBottom } = drawLetterhead(page, { font, bold }, {
    legalName: d.company.name, registeredAddress: d.company.registeredAddress,
    phone: d.company.phone, email: d.company.email, website: d.company.website, gstin: d.company.gstin,
  }, { emblem });

  let y = headerBottom - 26;
  text('LETTER OF POSSESSION', M, y, 14, bold, NAVY);
  right(d.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }), W - M, y, 9, font, MUTE);
  y -= 30;

  text('To,', M, y, 10); y -= 14; text(d.buyerName, M, y, 12, bold, NAVY); y -= 20;
  text(`Ref: ${d.reference ?? '—'}  |  Unit ${d.unit}, ${d.project}${d.typology ? ` (${d.typology})` : ''}${d.area ? ` · ${d.area} sq.ft` : ''}`, M, y, 9.5, font, MUTE); y -= 22;

  const intro = `Dear ${d.buyerName}, we are delighted to hand over possession of your home, Unit ${d.unit} at ${d.project}. All dues on your account have been cleared and the unit is ready for you. This letter confirms that possession is being handed over to you on the date above, together with the keys and the completion documents for your records.`;
  for (const ln of wrap(intro, 10, W - 2 * M)) { text(ln, M, y, 10); y -= 14; }
  y -= 10;

  // Handover checklist
  text('HANDOVER CHECKLIST', M, y, 8.5, bold, GOLD); y -= 6;
  page.drawLine({ start: { x: M, y: y - 4 }, end: { x: W - M, y: y - 4 }, thickness: 0.5, color: LINE }); y -= 20;
  for (const item of d.checklist) {
    const box = item.done ? '[x]' : '[  ]';
    text(box, M, y, 10, bold, item.done ? NAVY : MUTE);
    text(item.label, M + 24, y, 10, font, CHARCOAL);
    y -= 17;
  }
  y -= 12;

  const ack = 'I/We acknowledge that I/we have inspected the unit and taken possession in good condition, and that any snags noted at the time of handover have been recorded in the snag register for rectification within the agreed service levels.';
  for (const ln of wrap(ack, 9.5, W - 2 * M)) { text(ln, M, y, 9.5, font, CHARCOAL); y -= 13; }
  y -= 34;

  page.drawLine({ start: { x: M, y }, end: { x: M + 180, y }, thickness: 0.6, color: LINE });
  text('Buyer signature', M, y - 13, 9, font, MUTE);
  page.drawLine({ start: { x: W - M - 180, y }, end: { x: W - M, y }, thickness: 0.6, color: LINE });
  right('For ' + d.company.name + ' — Authorised Signatory', W - M, y - 13, 9, font, MUTE);

  return doc.save();
}
