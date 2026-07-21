import 'server-only';
import type { PDFPage, PDFFont } from 'pdf-lib';
import { rgb } from 'pdf-lib';

const BRASS = rgb(0.627, 0.49, 0.204);
const CHARCOAL = rgb(0.063, 0.059, 0.051);
const MUTE = rgb(0.45, 0.42, 0.38);
const LINE = rgb(0.85, 0.83, 0.79);

export interface LetterheadCompany {
  legalName: string;
  registeredAddress?: string;
  phone?: string;
  email?: string;
  website?: string;
  gstin?: string;
}

const ascii = (s: string) =>
  (s || '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/₹/g, 'Rs.')
    .replace(/[^\x20-\x7E]/g, ' ');

/**
 * Draw the Ameya letterhead directly onto a page.
 *
 * Deliberately drawn rather than stamped from the supplied artwork: that image
 * has the contact details baked in, and they were out of date. Drawing from the
 * company record means a change in Admin > Company Details reaches every
 * document immediately, and nothing can quietly go stale again.
 */
export function drawLetterhead(
  page: PDFPage,
  fonts: { font: PDFFont; bold: PDFFont; display?: PDFFont },
  company: LetterheadCompany,
  opts: { compact?: boolean } = {},
): { headerBottom: number; footerTop: number } {
  const { width: W, height: H } = page.getSize();
  const M = 48;
  const { font, bold } = fonts;
  const display = fonts.display ?? bold;

  const text = (s: string, x: number, y: number, size: number, f: PDFFont, color = CHARCOAL) =>
    page.drawText(ascii(s), { x, y, size, font: f, color });
  const centred = (s: string, y: number, size: number, f: PDFFont, color = CHARCOAL) => {
    const w = f.widthOfTextAtSize(ascii(s), size);
    page.drawText(ascii(s), { x: (W - w) / 2, y, size, font: f, color });
  };

  // Top brass band, as on the printed sheet.
  page.drawRectangle({ x: 0, y: H - 14, width: W, height: 14, color: BRASS });

  // Wordmark, letter-spaced inside a hairline box.
  const name = company.legalName.replace(/\s+LLP$/i, '').toUpperCase();
  const spaced = name.split('').join(' ');
  const size = opts.compact ? 12 : 14;
  const boxW = Math.min(W - 2 * M, display.widthOfTextAtSize(ascii(spaced), size) + 44);
  const boxH = opts.compact ? 26 : 30;
  const boxY = H - (opts.compact ? 58 : 66);
  page.drawRectangle({
    x: (W - boxW) / 2, y: boxY, width: boxW, height: boxH,
    borderColor: LINE, borderWidth: 0.75,
  });
  // The small brass tick above the first letter.
  page.drawRectangle({ x: (W - boxW) / 2 + 20, y: boxY + boxH - 6, width: 10, height: 1.6, color: BRASS });
  centred(spaced, boxY + boxH / 2 - size / 2 + 1, size, display, CHARCOAL);

  const headerBottom = boxY - 16;
  page.drawLine({ start: { x: M, y: headerBottom }, end: { x: W - M, y: headerBottom }, thickness: 0.6, color: LINE });

  // Footer: contact details, drawn from the company record.
  const footerTop = 86;
  page.drawLine({ start: { x: M, y: footerTop }, end: { x: W - M, y: footerTop }, thickness: 0.6, color: LINE });
  centred(company.legalName.toUpperCase(), footerTop - 14, 9, bold, CHARCOAL);
  if (company.registeredAddress) centred(company.registeredAddress, footerTop - 26, 7.5, font, MUTE);
  const contact = [company.phone, company.email, company.website?.replace(/^https?:\/\//, '')]
    .filter(Boolean)
    .join('    ');
  if (contact) centred(contact, footerTop - 37, 7.5, font, MUTE);
  if (company.gstin) centred(`GSTIN ${company.gstin}`, footerTop - 48, 7, font, MUTE);

  page.drawRectangle({ x: 0, y: 0, width: W, height: 10, color: BRASS });
  void text;
  return { headerBottom, footerTop };
}
