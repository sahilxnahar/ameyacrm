import 'server-only';
import type { PDFPage, PDFFont, PDFImage } from 'pdf-lib';
import { rgb } from 'pdf-lib';

// Brand palette — navy + gold (the Ameya house colours), not yellow.
const NAVY = rgb(0.106, 0.165, 0.290);   // #1B2A4A
const GOLD = rgb(0.627, 0.49, 0.204);    // #A07D34
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
 * Draw the Ameya letterhead directly onto a page — navy bands, a gold rule, the
 * emblem centred at the top and, when supplied, a faint emblem watermark behind
 * the content.
 *
 * Deliberately drawn rather than stamped from a flat artwork so the contact
 * details come from the live company record and can never quietly go stale.
 */
export function drawLetterhead(
  page: PDFPage,
  fonts: { font: PDFFont; bold: PDFFont; display?: PDFFont },
  company: LetterheadCompany,
  opts: { compact?: boolean; emblem?: PDFImage } = {},
): { headerBottom: number; footerTop: number } {
  const { width: W, height: H } = page.getSize();
  const M = 48;
  const { font, bold } = fonts;
  const display = fonts.display ?? bold;

  const centred = (s: string, y: number, size: number, f: PDFFont, color = CHARCOAL) => {
    const w = f.widthOfTextAtSize(ascii(s), size);
    page.drawText(ascii(s), { x: (W - w) / 2, y, size, font: f, color });
  };

  // Faint emblem watermark, centred, drawn first so everything else sits on top.
  if (opts.emblem) {
    const wm = 360;
    const dims = opts.emblem.scale(wm / opts.emblem.width);
    page.drawImage(opts.emblem, {
      x: (W - dims.width) / 2,
      y: (H - dims.height) / 2 - 20,
      width: dims.width,
      height: dims.height,
      opacity: 0.05,
    });
  }

  // Navy top band with a gold rule beneath it.
  page.drawRectangle({ x: 0, y: H - 15, width: W, height: 15, color: NAVY });
  page.drawRectangle({ x: 0, y: H - 18, width: W, height: 2.4, color: GOLD });

  // Emblem centred at the top.
  let boxY: number;
  if (opts.emblem) {
    const size = opts.compact ? 30 : 38;
    const dims = opts.emblem.scale(size / opts.emblem.width);
    page.drawImage(opts.emblem, { x: (W - dims.width) / 2, y: H - (opts.compact ? 52 : 62), width: dims.width, height: dims.height });
    boxY = H - (opts.compact ? 90 : 106);
  } else {
    boxY = H - (opts.compact ? 58 : 66);
  }

  // Wordmark, letter-spaced inside a hairline box — navy text, gold tick.
  const name = company.legalName.replace(/\s+LLP$/i, '').toUpperCase();
  const spaced = name.split('').join(' ');
  const size = opts.compact ? 12 : 14;
  const boxW = Math.min(W - 2 * M, display.widthOfTextAtSize(ascii(spaced), size) + 44);
  const boxH = opts.compact ? 26 : 30;
  page.drawRectangle({
    x: (W - boxW) / 2, y: boxY, width: boxW, height: boxH,
    borderColor: GOLD, borderWidth: 0.75,
  });
  page.drawRectangle({ x: (W - boxW) / 2 + 20, y: boxY + boxH - 6, width: 10, height: 1.6, color: GOLD });
  centred(spaced, boxY + boxH / 2 - size / 2 + 1, size, display, NAVY);

  const headerBottom = boxY - 16;
  page.drawLine({ start: { x: M, y: headerBottom }, end: { x: W - M, y: headerBottom }, thickness: 0.6, color: LINE });

  // Footer: a gold hairline, then contact details from the company record.
  const footerTop = 86;
  page.drawLine({ start: { x: M, y: footerTop }, end: { x: W - M, y: footerTop }, thickness: 0.7, color: GOLD });
  centred(company.legalName.toUpperCase(), footerTop - 14, 9, bold, NAVY);
  if (company.registeredAddress) centred(company.registeredAddress, footerTop - 26, 7.5, font, MUTE);
  const contact = [company.phone, company.email, company.website?.replace(/^https?:\/\//, '')]
    .filter(Boolean)
    .join('    ');
  if (contact) centred(contact, footerTop - 37, 7.5, font, MUTE);
  if (company.gstin) centred(`GSTIN ${company.gstin}`, footerTop - 48, 7, font, MUTE);

  // Bottom navy band with a gold rule above it.
  page.drawRectangle({ x: 0, y: 10, width: W, height: 2.4, color: GOLD });
  page.drawRectangle({ x: 0, y: 0, width: W, height: 10, color: NAVY });
  return { headerBottom, footerTop };
}
